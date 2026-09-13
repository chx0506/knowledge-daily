export function padIssue(issueNo: number): string {
  return `NO.${String(issueNo).padStart(4, "0")}`;
}

export function pageLabel(no: string): string {
  return `P.${no.padStart(3, "0")}`;
}

export function formatQuota(used: number, total: number): string {
  return `${used} / ${total}`;
}
