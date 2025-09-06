module.exports = {
  plugins: [require("@trivago/prettier-plugin-sort-imports")],
  importOrder: ["^@/(.*)$", "^[./]"],
  importOrderSeparation: true,
  importOrderSortSpecifiers: true,
};
