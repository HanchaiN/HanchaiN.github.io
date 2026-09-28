#!/usr/bin/sh -e

PAGE_DIR=./posts
TMP_DIR=./dist/tmp
OUT_DIR=./dist/out
SMU_BIN=./external/smu/smu
SAAIT_BIN=./external/saait/saait

GLOBAL_CONFIG=./config.cfg
TEMPLATE_DIR=./templates

{ cd ./posts && find . -type f -name '*.cfg' -print ;} | while read -r file; do
    mkdir -p "${TMP_DIR}/$(dirname "$file")"
    if [ -f "${PAGE_DIR}/${file%.cfg}.md" ]; then
        # https://github.com/Gottox/smu
        "${SMU_BIN}" -n < "${PAGE_DIR}/${file%.cfg}.md" > "${TMP_DIR}/${file%.cfg}.html"
    elif [ -f "${PAGE_DIR}/${file%.cfg}.html" ]; then
        cp "${PAGE_DIR}/${file%.cfg}.html" > "${TMP_DIR}/${file%.cfg}.html"
    else
        echo "${PAGE_DIR}/${file} do not have a corresponding content" >&2
    fi
    cp "${PAGE_DIR}/$file" "${TMP_DIR}/$file"
done

# https://git.codemadness.org/saait/
mkdir -p "$OUT_DIR"
find "${TMP_DIR}" -type f -name '*.cfg' -print0 | sort -zr | xargs -0 "${SAAIT_BIN}" -c "$GLOBAL_CONFIG" -o "$OUT_DIR" -t "$TEMPLATE_DIR"

# TODO: use saait for all pages
cp -r pages/* "$OUT_DIR"/
