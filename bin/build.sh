#!/usr/bin/sh -e

ROOT_DIR="${ROOT_DIR:-./pages}"
REL_DIR="${REL_DIR:-.}"
PAGE_DIR="${ROOT_DIR}/${REL_DIR}"
OUT_DIR="${OUT_DIR:-./dist}"
GLOBAL_CONFIG="${GLOBAL_CONFIG:-${PAGE_DIR}/.saait.cfg}"
TEMPLATE_DIR="${TEMPLATE_DIR:-${PAGE_DIR}/_templates}"
SMU_BIN="${SMU_BIN:-./external/smu/smu}"
SAAIT_BIN="${SAAIT_BIN:-./external/saait/saait}"

TMP_DIR="$(mktemp -d)"
echo "Process ${PAGE_DIR} -> ${TMP_DIR} -> ${OUT_DIR}"

{ cd "${ROOT_DIR}" && find "$REL_DIR" -depth -type f -name '.saait.cfg' -print ;} | tac | while read -r file; do
    path="$(dirname "$file")"
    mkdir -p "${TMP_DIR}/${path}"
    [ -f "${TMP_DIR}/${path}/.locked" ] && continue
    [ "$path" = "$REL_DIR" ] && continue
    mkdir -p "${TMP_DIR}/${path}"
    echo "Entering ${path}"
    REL_DIR="${path}" OUT_DIR="${TMP_DIR}" GLOBAL_CONFIG= TEMPLATE_DIR= "$0"
    echo "Exiting ${path}"
    find "${TMP_DIR}/${path}/" -depth -type d -exec touch {}/.locked \; ;
done

{ cd "${ROOT_DIR}" && find "$REL_DIR" -type f -name '*.cfg' -print ;} | while read -r file; do
    [ "$(basename "$file")" = '.saait.cfg' ] && continue
    path="$(dirname "$file")"
    mkdir -p "${TMP_DIR}/${path}" "${OUT_DIR}/${path}"
    if [ -f "${TMP_DIR}/${path}/.locked" ]; then
        cp "${ROOT_DIR}/$file" "${TMP_DIR}/$file"
        continue
    fi
    echo "Pre-processing $file"
    if [ -f "${ROOT_DIR}/${file%.cfg}.md" ]; then
        # https://github.com/Gottox/smu
        "${SMU_BIN}" -n < "${ROOT_DIR}/${file%.cfg}.md" > "${TMP_DIR}/${file%.cfg}.html"
        cp "${ROOT_DIR}/$file" "${TMP_DIR}/$file"
    elif [ -f "${ROOT_DIR}/${file%.cfg}.html" ]; then
        cp "${ROOT_DIR}/${file%.cfg}.html" "${TMP_DIR}/${file%.cfg}.html"
        cp "${ROOT_DIR}/$file" "${TMP_DIR}/$file"
    else
        echo "${file} do not have a corresponding content" >&2
    fi
done

# https://git.codemadness.org/saait/
mkdir -p "$OUT_DIR"
find "${TMP_DIR}" -type f -name '*.cfg' -print0 | sort -zr | xargs -0 "${SAAIT_BIN}" -c "$GLOBAL_CONFIG" -o "$OUT_DIR" -t "$TEMPLATE_DIR"
rm -rf "$TMP_DIR"

{ cd "${ROOT_DIR}" && find "$REL_DIR" -type f -a \( -name '*.html' -o -name '*.css' \) -print ;} | while read -r file; do
    [ -f "${OUT_DIR}/$file" ] && continue
    [ "$(basename $(dirname $(dirname "$file")))" = '_templates' ] && continue
    mkdir -p "${OUT_DIR}/$(dirname "$file")"
    echo "Copying $file"
    cp "${ROOT_DIR}/$file" "${OUT_DIR}/$file"
done
