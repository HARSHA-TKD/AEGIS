from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db import get_db
from app.models import Repository, Scan, User
from app.schemas.repo import RepoConnect, RepoOut, RepoUpdate
from app.schemas.scan import ScanOut
from app.services.crypto import encrypt_token
from app.services.github import GitHubClient, GitHubError, parse_full_name
from app.services.scan_runner import run_scan

router = APIRouter(prefix="/repos", tags=["repositories"])


def _get_repo(db: Session, user: User, repo_id: str) -> Repository:
    repository = db.get(Repository, repo_id)
    if repository is None or repository.user_id != user.id:
        raise HTTPException(status_code=404, detail="Repository not found.")
    return repository


@router.get("", response_model=list[RepoOut])
def list_repos(
    db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> list[Repository]:
    return list(
        db.scalars(
            select(Repository)
            .where(Repository.user_id == user.id)
            .order_by(Repository.risk.desc(), Repository.name.asc())
        )
    )


@router.post("", response_model=RepoOut, status_code=status.HTTP_201_CREATED)
def connect_repo(
    payload: RepoConnect,
    background: BackgroundTasks,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Repository:
    try:
        owner, name = parse_full_name(payload.full_name)
    except GitHubError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc

    full_name = f"{owner}/{name}"
    existing = db.scalar(
        select(Repository).where(
            Repository.user_id == user.id,
            Repository.provider == "github",
            Repository.full_name == full_name,
        )
    )
    if existing is not None:
        raise HTTPException(status_code=409, detail="This repository is already connected.")

    try:
        with GitHubClient(token=payload.token) as client:
            remote = client.get_repository(full_name)
    except GitHubError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc

    branch = payload.branch or remote.get("default_branch") or "main"

    repository = Repository(
        user_id=user.id,
        provider="github",
        full_name=full_name,
        name=remote.get("name") or name,
        org=owner,
        external_id=str(remote.get("id")) if remote.get("id") is not None else None,
        clone_url=remote.get("clone_url"),
        language=remote.get("language") or "Unknown",
        branch=branch,
        token_encrypted=encrypt_token(payload.token) if payload.token else None,
        status="scanning",
    )
    db.add(repository)
    db.commit()
    db.refresh(repository)

    scan = Scan(
        repository_id=repository.id,
        triggered_by=user.id,
        status="queued",
    )
    db.add(scan)
    db.commit()
    db.refresh(scan)
    background.add_task(run_scan, scan.id)

    return repository


@router.get("/{repo_id}", response_model=RepoOut)
def get_repo(
    repo_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Repository:
    return _get_repo(db, user, repo_id)


@router.patch("/{repo_id}", response_model=RepoOut)
def update_repo(
    repo_id: str,
    payload: RepoUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Repository:
    repository = _get_repo(db, user, repo_id)
    if payload.branch:
        repository.branch = payload.branch
    if payload.token:
        repository.token_encrypted = encrypt_token(payload.token)
    db.commit()
    db.refresh(repository)
    return repository


@router.delete("/{repo_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_repo(
    repo_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    repository = _get_repo(db, user, repo_id)
    db.delete(repository)
    db.commit()


@router.post(
    "/{repo_id}/scan",
    response_model=ScanOut,
    status_code=status.HTTP_202_ACCEPTED,
)
def start_scan(
    repo_id: str,
    background: BackgroundTasks,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Scan:
    repository = _get_repo(db, user, repo_id)
    scan = Scan(
        repository_id=repository.id,
        triggered_by=user.id,
        status="queued",
    )
    repository.status = "scanning"
    db.add(scan)
    db.commit()
    db.refresh(scan)
    background.add_task(run_scan, scan.id)
    return scan
