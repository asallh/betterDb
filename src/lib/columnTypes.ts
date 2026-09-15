/**
 * Monochrome type cues — weight/opacity only, no brand color.
 * Keeps the OEM grey palette while still hinting at type families.
 */
const TYPE_COLORS: Record<string, string> = {
  int2: "text-foreground/80",
  int4: "text-foreground/80",
  int8: "text-foreground/80",
  smallint: "text-foreground/80",
  int: "text-foreground/80",
  bigint: "text-foreground/80",
  tinyint: "text-foreground/80",
  float4: "text-foreground/70",
  float8: "text-foreground/70",
  numeric: "text-foreground/70",
  real: "text-foreground/70",
  float: "text-foreground/70",
  decimal: "text-foreground/70",
  money: "text-foreground/70",
  bool: "text-foreground/60",
  bit: "text-foreground/60",
  text: "text-muted-foreground",
  varchar: "text-muted-foreground",
  nvarchar: "text-muted-foreground",
  bpchar: "text-muted-foreground",
  char: "text-muted-foreground",
  nchar: "text-muted-foreground",
  name: "text-muted-foreground",
  date: "text-foreground/55",
  time: "text-foreground/55",
  timetz: "text-foreground/55",
  timestamp: "text-foreground/55",
  timestamptz: "text-foreground/55",
  datetime: "text-foreground/55",
  datetime2: "text-foreground/55",
  datetimeoffset: "text-foreground/55",
  smalldatetime: "text-foreground/55",
  interval: "text-foreground/55",
  uuid: "text-foreground/50",
  uniqueidentifier: "text-foreground/50",
  json: "text-foreground/65",
  jsonb: "text-foreground/65",
  bytea: "text-foreground/45",
  binary: "text-foreground/45",
  varbinary: "text-foreground/45",
  image: "text-foreground/45",
  inet: "text-muted-foreground",
  cidr: "text-muted-foreground",
  macaddr: "text-muted-foreground",
};

export function getTypeColor(dataType: string): string {
  const normalized = dataType.toLowerCase().replace(/\(.*/, "");
  return TYPE_COLORS[normalized] ?? "text-muted-foreground";
}
