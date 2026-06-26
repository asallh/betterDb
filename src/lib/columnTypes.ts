const TYPE_COLORS: Record<string, string> = {
  int2: "text-blue-500",
  int4: "text-blue-500",
  int8: "text-blue-500",
  float4: "text-blue-500",
  float8: "text-blue-500",
  numeric: "text-blue-500",
  money: "text-blue-500",
  bool: "text-amber-500",
  text: "text-green-600 dark:text-green-400",
  varchar: "text-green-600 dark:text-green-400",
  bpchar: "text-green-600 dark:text-green-400",
  char: "text-green-600 dark:text-green-400",
  name: "text-green-600 dark:text-green-400",
  date: "text-purple-500",
  time: "text-purple-500",
  timetz: "text-purple-500",
  timestamp: "text-purple-500",
  timestamptz: "text-purple-500",
  interval: "text-purple-500",
  uuid: "text-orange-500",
  json: "text-pink-500",
  jsonb: "text-pink-500",
  bytea: "text-red-500",
  inet: "text-cyan-500",
  cidr: "text-cyan-500",
  macaddr: "text-cyan-500",
};

export function getTypeColor(dataType: string): string {
  return TYPE_COLORS[dataType] ?? "text-muted-foreground";
}
