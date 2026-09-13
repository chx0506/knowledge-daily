export function html(strings: TemplateStringsArray, ...values: unknown[]): string {
  return strings.reduce((output, chunk, index) => {
    const value = values[index];
    return output + chunk + (value == null ? "" : String(value));
  }, "");
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
