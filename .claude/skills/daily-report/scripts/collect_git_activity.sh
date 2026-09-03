#!/usr/bin/env bash
# 일일 업무보고용 Git 활동 수집기
#
# 사용법:
#   collect_git_activity.sh [날짜] [작성자]
#     날짜   : YYYY-MM-DD (기본값: 오늘, Asia/Seoul 기준)
#     작성자 : git author 필터 (기본값: git config user.email, 없으면 전체)
#
# 여러 저장소를 함께 보고하려면 환경변수로 경로를 넘긴다:
#   DAILY_REPORT_REPOS="/path/a:/path/b" collect_git_activity.sh
#
# 출력: 사람이 읽을 수 있는 원시 활동 로그(마크다운). 해석·요약은 하지 않는다.

set -uo pipefail

# 모든 시각 표기를 한국 시간 기준으로 통일 (git format-local 포함)
export TZ="${DAILY_REPORT_TZ:-Asia/Seoul}"

DATE="${1:-$(date +%F)}"
AUTHOR_ARG="${2:-}"

if ! date -d "$DATE" +%F >/dev/null 2>&1; then
  echo "오류: 날짜 형식이 잘못됐습니다 ('$DATE'). YYYY-MM-DD 로 지정하세요." >&2
  exit 1
fi

SINCE="$DATE 00:00:00"
UNTIL="$DATE 23:59:59"

# 대상 저장소 목록
declare -a REPOS=()
if [[ -n "${DAILY_REPORT_REPOS:-}" ]]; then
  IFS=':' read -r -a REPOS <<< "$DAILY_REPORT_REPOS"
else
  REPOS=("$(pwd)")
fi

echo "# Git 활동 원시 로그"
echo
echo "- 대상 날짜: $DATE ($TZ)"
echo "- 수집 시각: $(date '+%F %H:%M') ($TZ)"

FOUND_ANY=0

for REPO in "${REPOS[@]}"; do
  [[ -z "$REPO" ]] && continue

  if ! git -c core.quotepath=false -C "$REPO" rev-parse --git-dir >/dev/null 2>&1; then
    echo
    echo "## $REPO"
    echo
    echo "> git 저장소가 아니어서 건너뜀."
    continue
  fi

  NAME="$(basename "$(git -c core.quotepath=false -C "$REPO" rev-parse --show-toplevel)")"

  AUTHOR="$AUTHOR_ARG"
  if [[ -z "$AUTHOR" ]]; then
    AUTHOR="$(git -c core.quotepath=false -C "$REPO" config user.email 2>/dev/null || true)"
  fi

  declare -a AUTHOR_OPT=()
  if [[ -n "$AUTHOR" ]]; then
    AUTHOR_OPT=(--author="$AUTHOR")
  fi

  echo
  echo "## 저장소: $NAME ($REPO)"
  echo
  echo "- 작성자 필터: ${AUTHOR:-(없음 - 전체 커밋)}"
  echo "- 현재 브랜치: $(git -c core.quotepath=false -C "$REPO" rev-parse --abbrev-ref HEAD 2>/dev/null || echo '(불명)')"

  # 해당 날짜 커밋 (모든 브랜치, 중복 제거)
  mapfile -t SHAS < <(git -c core.quotepath=false -C "$REPO" log --all --no-merges \
      "${AUTHOR_OPT[@]}" \
      --since="$SINCE" --until="$UNTIL" \
      --pretty=format:%H 2>/dev/null | awk '!seen[$0]++')

  echo
  echo "### 커밋 (${#SHAS[@]}건)"

  if [[ ${#SHAS[@]} -eq 0 ]]; then
    echo
    echo "> 해당 날짜에 커밋 없음."
  else
    FOUND_ANY=1
    for SHA in "${SHAS[@]}"; do
      BRANCHES="$(git -c core.quotepath=false -C "$REPO" branch --all --contains "$SHA" 2>/dev/null \
        | sed -e 's/^[* ] //' -e 's|^remotes/[^/]*/||' \
        | grep -v 'HEAD detached' | awk '!seen[$0]++' \
        | tr '\n' ',' | sed 's/,$//; s/,/, /g')"
      echo
      git -c core.quotepath=false -C "$REPO" show -s --date=format-local:'%H:%M' \
        --pretty=format:'- **%h** %ad | %s' "$SHA" 2>/dev/null
      echo
      echo "  - 브랜치: ${BRANCHES:-(불명)}"
      echo "  - 변경 통계: $(git -c core.quotepath=false -C "$REPO" show --shortstat --pretty=format: "$SHA" 2>/dev/null | tr -s ' \n' ' ' | sed 's/^ *//;s/ *$//')"
      echo "  - 변경 파일:"
      git -c core.quotepath=false -C "$REPO" show --numstat --pretty=format: "$SHA" 2>/dev/null \
        | awk 'NF==3 {printf "    - %s (+%s/-%s)\n", $3, $1, $2}' | head -40
      TOTAL_FILES=$(git -c core.quotepath=false -C "$REPO" show --numstat --pretty=format: "$SHA" 2>/dev/null | awk 'NF==3' | wc -l)
      if [[ "$TOTAL_FILES" -gt 40 ]]; then
        echo "    - ... 외 $((TOTAL_FILES - 40))개 파일"
      fi
      BODY="$(git -c core.quotepath=false -C "$REPO" show -s --pretty=format:%b "$SHA" 2>/dev/null \
        | grep -v -e '^Co-Authored-By:' -e '^Claude-Session:' -e '^$' | head -10)"
      if [[ -n "$BODY" ]]; then
        echo "  - 커밋 본문:"
        printf '%s\n' "$BODY" | sed 's/^/    > /'
      fi
    done
  fi

  # 미커밋 변경 = 아직 진행 중인 작업 단서
  echo
  echo "### 미커밋 변경 (진행 중 작업 단서)"
  STATUS="$(git -c core.quotepath=false -C "$REPO" status --porcelain 2>/dev/null | head -30)"
  if [[ -z "$STATUS" ]]; then
    echo
    echo "> 없음 (작업 트리 깨끗)."
  else
    echo
    printf '%s\n' "$STATUS" | sed 's/^/- /'
  fi

  # 오늘 손댄 로컬 브랜치
  echo
  echo "### 최근 갱신된 로컬 브랜치"
  echo
  git -c core.quotepath=false -C "$REPO" for-each-ref --sort=-committerdate refs/heads/ \
    --format='- %(refname:short) | 최종 커밋 %(committerdate:format-local:%F %H:%M)' 2>/dev/null | head -10
done

echo
if [[ "$FOUND_ANY" -eq 0 ]]; then
  echo "> **주의:** 대상 날짜에 수집된 커밋이 없습니다. 날짜/작성자 필터를 확인하거나, 비개발 업무는 사용자에게 직접 물어 채워야 합니다."
fi
