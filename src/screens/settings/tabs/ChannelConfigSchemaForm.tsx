import type { JSX } from "react";
import {
  Button,
  Field,
  Input,
  Switch,
  Text,
  makeStyles,
  tokens,
} from "@fluentui/react-components";

export type ConfigPathSegment =
  | { kind: "key"; key: string }
  | { kind: "index"; index: number };

export type ConfigPath = ConfigPathSegment[];

export interface ConfigUiHint {
  label?: string;
  help?: string;
  order?: number;
  advanced?: boolean;
  sensitive?: boolean;
  placeholder?: string;
}

export interface ConfigSchemaNode {
  raw: Record<string, unknown>;
}

interface ChannelConfigSchemaFormProps {
  schema: ConfigSchemaNode;
  basePath: ConfigPath;
  hints: Record<string, ConfigUiHint>;
  getValue: (path: ConfigPath) => unknown;
  setValue: (path: ConfigPath, value: unknown | undefined) => void;
  disabled?: boolean;
}

const useStyles = makeStyles({
  group: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  node: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    padding: "8px 0",
  },
  objectBody: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    paddingLeft: "8px",
    borderLeft: `2px solid ${tokens.colorNeutralStroke2}`,
  },
  row: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
  },
  helper: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
  },
  arrayItem: {
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: "6px",
    padding: "8px",
  },
  mapKeyInput: {
    width: "220px",
  },
  select: {
    minHeight: "32px",
    padding: "4px 8px",
    borderRadius: "4px",
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    backgroundColor: tokens.colorNeutralBackground1,
    color: tokens.colorNeutralForeground1,
  },
});

function asRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return undefined;
}

function toStringValue(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parsePathKey(path: ConfigPath): string {
  return path
    .map((segment) => (segment.kind === "key" ? segment.key : null))
    .filter((segment): segment is string => Boolean(segment))
    .join(".");
}

export function keySegment(key: string): ConfigPathSegment {
  return { kind: "key", key };
}

export function indexSegment(index: number): ConfigPathSegment {
  return { kind: "index", index };
}

export function parseConfigSchemaNode(raw: unknown): ConfigSchemaNode | null {
  if (!asRecord(raw)) return null;
  return { raw };
}

function parseChildNode(raw: unknown): ConfigSchemaNode | null {
  return parseConfigSchemaNode(raw);
}

function schemaTitle(node: ConfigSchemaNode): string | undefined {
  return toStringValue(node.raw.title);
}

function schemaDescription(node: ConfigSchemaNode): string | undefined {
  return toStringValue(node.raw.description);
}

function schemaEnum(node: ConfigSchemaNode): unknown[] | undefined {
  return Array.isArray(node.raw.enum) ? node.raw.enum : undefined;
}

function schemaConst(node: ConfigSchemaNode): unknown {
  return node.raw.const;
}

function schemaDefault(node: ConfigSchemaNode): unknown {
  if (node.raw.default !== undefined) return node.raw.default;
  switch (schemaType(node)) {
    case "object":
      return {};
    case "array":
      return [];
    case "boolean":
      return false;
    case "integer":
      return 0;
    case "number":
      return 0;
    case "string":
      return "";
    default:
      return "";
  }
}

function schemaTypeList(node: ConfigSchemaNode): string[] {
  const rawType = node.raw.type;
  if (typeof rawType === "string") return [rawType];
  if (Array.isArray(rawType)) {
    return rawType.filter((item): item is string => typeof item === "string");
  }
  return [];
}

function schemaType(node: ConfigSchemaNode): string | undefined {
  const list = schemaTypeList(node);
  const filtered = list.filter((entry) => entry !== "null");
  if (filtered.length > 0) return filtered[0];
  if (list.length > 0) return list[0];
  return undefined;
}

function isNullSchema(node: ConfigSchemaNode): boolean {
  const list = schemaTypeList(node);
  return list.length === 1 && list[0] === "null";
}

function schemaProperties(
  node: ConfigSchemaNode
): Record<string, ConfigSchemaNode> {
  if (!asRecord(node.raw.properties)) return {};
  const entries = Object.entries(node.raw.properties)
    .map(([key, value]) => [key, parseChildNode(value)] as const)
    .filter((entry): entry is readonly [string, ConfigSchemaNode] =>
      Boolean(entry[1])
    );
  return Object.fromEntries(entries);
}

function schemaAnyOf(node: ConfigSchemaNode): ConfigSchemaNode[] {
  if (!Array.isArray(node.raw.anyOf)) return [];
  return node.raw.anyOf
    .map(parseChildNode)
    .filter((entry): entry is ConfigSchemaNode => Boolean(entry));
}

function schemaOneOf(node: ConfigSchemaNode): ConfigSchemaNode[] {
  if (!Array.isArray(node.raw.oneOf)) return [];
  return node.raw.oneOf
    .map(parseChildNode)
    .filter((entry): entry is ConfigSchemaNode => Boolean(entry));
}

function schemaLiteral(node: ConfigSchemaNode): unknown {
  const constValue = schemaConst(node);
  if (constValue !== undefined) return constValue;
  const enumValues = schemaEnum(node);
  if (enumValues && enumValues.length === 1) return enumValues[0];
  return undefined;
}

function schemaItems(node: ConfigSchemaNode): ConfigSchemaNode | null {
  if (Array.isArray(node.raw.items)) {
    return parseChildNode(node.raw.items[0]);
  }
  return parseChildNode(node.raw.items);
}

function schemaAdditional(node: ConfigSchemaNode): ConfigSchemaNode | null {
  if (!asRecord(node.raw.additionalProperties)) return null;
  return parseChildNode(node.raw.additionalProperties);
}

function allowsAdditional(node: ConfigSchemaNode): boolean {
  if (typeof node.raw.additionalProperties === "boolean") {
    return node.raw.additionalProperties;
  }
  return schemaAdditional(node) !== null;
}

function schemaNodeAtPathInternal(
  node: ConfigSchemaNode,
  path: ConfigPath
): ConfigSchemaNode | null {
  let current: ConfigSchemaNode | null = node;
  for (const segment of path) {
    if (!current) return null;
    if (segment.kind === "key") {
      if (schemaType(current) !== "object") return null;
      const properties = schemaProperties(current);
      if (segment.key in properties) {
        current = properties[segment.key];
      } else {
        current = schemaAdditional(current);
      }
    } else {
      if (schemaType(current) !== "array") return null;
      current = schemaItems(current);
    }
  }
  return current;
}

export function schemaNodeAtPath(
  node: ConfigSchemaNode,
  path: ConfigPath
): ConfigSchemaNode | null {
  return schemaNodeAtPathInternal(node, path);
}

function cloneDeep<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function getValueAtPath(root: unknown, path: ConfigPath): unknown {
  let current: unknown = root;
  for (const segment of path) {
    if (segment.kind === "key") {
      if (!asRecord(current)) return undefined;
      current = current[segment.key];
    } else {
      if (!Array.isArray(current)) return undefined;
      current = current[segment.index];
    }
  }
  return current;
}

function setValueRecursive(
  current: unknown,
  path: ConfigPath,
  value: unknown | undefined
): unknown {
  if (path.length === 0) {
    return value;
  }

  const [head, ...tail] = path;
  if (head.kind === "key") {
    const next = asRecord(current) ? cloneDeep(current) : {};
    if (tail.length === 0) {
      if (value === undefined) {
        delete next[head.key];
      } else {
        next[head.key] = value;
      }
      return next;
    }

    const childCurrent = next[head.key];
    const childNext = setValueRecursive(childCurrent, tail, value);
    if (childNext === undefined) {
      delete next[head.key];
    } else {
      next[head.key] = childNext;
    }
    return next;
  }

  const next = Array.isArray(current) ? cloneDeep(current) : [];
  const index = head.index;
  while (next.length <= index) {
    next.push(null);
  }

  if (tail.length === 0) {
    if (value === undefined) {
      next.splice(index, 1);
    } else {
      next[index] = value;
    }
    return next;
  }

  const childCurrent = next[index];
  const childNext = setValueRecursive(childCurrent, tail, value);
  next[index] = childNext;
  return next;
}

export function setValueAtPath(
  root: unknown,
  path: ConfigPath,
  value: unknown | undefined
): unknown {
  return setValueRecursive(root, path, value);
}

export function decodeUiHints(raw: unknown): Record<string, ConfigUiHint> {
  if (!asRecord(raw)) return {};
  const entries = Object.entries(raw)
    .map(([key, value]) => {
      if (!asRecord(value)) return null;
      const hint: ConfigUiHint = {
        label: toStringValue(value.label),
        help: toStringValue(value.help),
        order: toNumber(value.order),
        advanced:
          typeof value.advanced === "boolean" ? value.advanced : undefined,
        sensitive:
          typeof value.sensitive === "boolean" ? value.sensitive : undefined,
        placeholder: toStringValue(value.placeholder),
      };
      return [key, hint] as const;
    })
    .filter((entry): entry is readonly [string, ConfigUiHint] =>
      Boolean(entry)
    );
  return Object.fromEntries(entries);
}

export function hintForPath(
  path: ConfigPath,
  hints: Record<string, ConfigUiHint>
): ConfigUiHint | undefined {
  const key = parsePathKey(path);
  if (hints[key]) return hints[key];

  const segments = key.split(".");
  for (const [hintKey, hint] of Object.entries(hints)) {
    if (!hintKey.includes("*")) continue;
    const hintSegments = hintKey.split(".");
    if (hintSegments.length !== segments.length) continue;

    let matches = true;
    for (let i = 0; i < segments.length; i += 1) {
      if (hintSegments[i] !== "*" && hintSegments[i] !== segments[i]) {
        matches = false;
        break;
      }
    }
    if (matches) return hint;
  }
  return undefined;
}

export function isSensitivePath(path: ConfigPath): boolean {
  const key = parsePathKey(path).toLowerCase();
  return (
    key.includes("token") ||
    key.includes("password") ||
    key.includes("secret") ||
    key.includes("apikey") ||
    key.endsWith("key")
  );
}

function compareLiteral(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function nodeVariant(node: ConfigSchemaNode): ConfigSchemaNode {
  const variants =
    schemaAnyOf(node).length > 0 ? schemaAnyOf(node) : schemaOneOf(node);
  if (variants.length === 0) return node;
  const nonNull = variants.filter((entry) => !isNullSchema(entry));
  if (nonNull.length === 1) return nonNull[0];
  return node;
}

function orderedPropertyKeys(
  path: ConfigPath,
  node: ConfigSchemaNode,
  hints: Record<string, ConfigUiHint>
): string[] {
  const properties = schemaProperties(node);
  const keys = Object.keys(properties);
  return keys.sort((lhs, rhs) => {
    const lhsOrder = hintForPath([...path, keySegment(lhs)], hints)?.order ?? 0;
    const rhsOrder = hintForPath([...path, keySegment(rhs)], hints)?.order ?? 0;
    if (lhsOrder !== rhsOrder) return lhsOrder - rhsOrder;
    return lhs.localeCompare(rhs);
  });
}

function valueAsString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  return JSON.stringify(value);
}

function labelFor(
  path: ConfigPath,
  node: ConfigSchemaNode,
  hints: Record<string, ConfigUiHint>
): string {
  const lastSegment = path[path.length - 1];
  const fallbackLabel =
    lastSegment && lastSegment.kind === "key" ? lastSegment.key : "Field";
  return hintForPath(path, hints)?.label ?? schemaTitle(node) ?? fallbackLabel;
}

function helpFor(
  path: ConfigPath,
  node: ConfigSchemaNode,
  hints: Record<string, ConfigUiHint>
): string | undefined {
  return hintForPath(path, hints)?.help ?? schemaDescription(node);
}

export function ChannelConfigSchemaForm({
  schema,
  basePath,
  hints,
  getValue,
  setValue,
  disabled,
}: ChannelConfigSchemaFormProps) {
  const styles = useStyles();

  const renderNode = (
    rawNode: ConfigSchemaNode,
    path: ConfigPath
  ): JSX.Element => {
    const node = nodeVariant(rawNode);
    const label = labelFor(path, node, hints);
    const help = helpFor(path, node, hints);
    const current = getValue(path);

    const variants =
      schemaAnyOf(node).length > 0 ? schemaAnyOf(node) : schemaOneOf(node);
    if (variants.length > 0) {
      const nonNull = variants.filter((entry) => !isNullSchema(entry));
      const literals = nonNull
        .map(schemaLiteral)
        .filter((entry) => entry !== undefined);
      if (literals.length > 0 && literals.length === nonNull.length) {
        const selectedIndex = literals.findIndex((literal) =>
          compareLiteral(literal, current)
        );
        return (
          <div className={styles.node}>
            <Field label={label} hint={help}>
              <select
                className={styles.select}
                disabled={disabled}
                value={selectedIndex >= 0 ? String(selectedIndex) : ""}
                onChange={(event) => {
                  const index = Number.parseInt(event.target.value, 10);
                  if (
                    Number.isNaN(index) ||
                    index < 0 ||
                    index >= literals.length
                  ) {
                    setValue(path, undefined);
                  } else {
                    setValue(path, literals[index]);
                  }
                }}
              >
                <option value="">Select...</option>
                {literals.map((literal, index) => (
                  <option key={String(index)} value={String(index)}>
                    {valueAsString(literal)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        );
      }
      if (nonNull.length === 1) {
        return renderNode(nonNull[0], path);
      }
    }

    switch (schemaType(node)) {
      case "object": {
        const properties = schemaProperties(node);
        const keys = orderedPropertyKeys(path, node, hints);
        const objectValue = asRecord(current) ? current : {};
        const additionalSchema = schemaAdditional(node);
        const extras = Object.keys(objectValue)
          .filter((key) => !(key in properties))
          .sort((a, b) => a.localeCompare(b));

        return (
          <div className={styles.node}>
            <Text weight="semibold">{label}</Text>
            {help && <Text className={styles.helper}>{help}</Text>}
            <div className={styles.objectBody}>
              {keys.map((key) => {
                const child = properties[key];
                return (
                  <div key={key}>
                    {renderNode(child, [...path, keySegment(key)])}
                  </div>
                );
              })}

              {allowsAdditional(node) && additionalSchema && (
                <div className={styles.group}>
                  <Text weight="semibold">Extra entries</Text>
                  {extras.length === 0 && (
                    <Text className={styles.helper}>No extra entries yet.</Text>
                  )}
                  {extras.map((key) => {
                    const itemPath = [...path, keySegment(key)];
                    return (
                      <div key={key} className={styles.arrayItem}>
                        <div className={styles.row}>
                          <Input
                            className={styles.mapKeyInput}
                            value={key}
                            disabled={disabled}
                            onChange={(_, data) => {
                              const nextKey = data.value.trim();
                              if (!nextKey || nextKey === key) return;
                              const currentValue = getValue(path);
                              if (!asRecord(currentValue)) return;
                              if (nextKey in currentValue) return;
                              const nextObject = cloneDeep(currentValue);
                              nextObject[nextKey] = nextObject[key];
                              delete nextObject[key];
                              setValue(path, nextObject);
                            }}
                          />
                          <Button
                            appearance="secondary"
                            disabled={disabled}
                            onClick={() => {
                              const currentValue = getValue(path);
                              if (!asRecord(currentValue)) return;
                              const nextObject = cloneDeep(currentValue);
                              delete nextObject[key];
                              setValue(path, nextObject);
                            }}
                          >
                            Remove
                          </Button>
                        </div>
                        <div>{renderNode(additionalSchema, itemPath)}</div>
                      </div>
                    );
                  })}

                  <Button
                    appearance="secondary"
                    disabled={disabled}
                    onClick={() => {
                      const currentValue = getValue(path);
                      const nextObject = asRecord(currentValue)
                        ? cloneDeep(currentValue)
                        : {};
                      let index = 1;
                      let key = `new-${index}`;
                      while (key in nextObject) {
                        index += 1;
                        key = `new-${index}`;
                      }
                      nextObject[key] = schemaDefault(additionalSchema);
                      setValue(path, nextObject);
                    }}
                  >
                    Add
                  </Button>
                </div>
              )}
            </div>
          </div>
        );
      }
      case "array": {
        const items = asArray(current);
        const itemSchema = schemaItems(node);
        return (
          <div className={styles.node}>
            <Text weight="semibold">{label}</Text>
            {help && <Text className={styles.helper}>{help}</Text>}
            <div className={styles.group}>
              {items.map((_, index) => {
                const itemPath = [...path, indexSegment(index)];
                return (
                  <div key={String(index)} className={styles.arrayItem}>
                    {itemSchema ? (
                      renderNode(itemSchema, itemPath)
                    ) : (
                      <Text>{valueAsString(items[index])}</Text>
                    )}
                    <Button
                      appearance="secondary"
                      disabled={disabled}
                      onClick={() => {
                        const next = [...items];
                        next.splice(index, 1);
                        setValue(path, next);
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                );
              })}
              <Button
                appearance="secondary"
                disabled={disabled}
                onClick={() => {
                  const next = [...items];
                  next.push(itemSchema ? schemaDefault(itemSchema) : "");
                  setValue(path, next);
                }}
              >
                Add
              </Button>
            </div>
          </div>
        );
      }
      case "boolean": {
        const checked =
          typeof current === "boolean" ? current : Boolean(schemaDefault(node));
        return (
          <div className={styles.node}>
            <Switch
              checked={checked}
              disabled={disabled}
              label={label}
              onChange={(_, data) => setValue(path, data.checked)}
            />
            {help && <Text className={styles.helper}>{help}</Text>}
          </div>
        );
      }
      case "number":
      case "integer": {
        const isInteger = schemaType(node) === "integer";
        const currentText = valueAsString(current ?? schemaDefault(node));
        return (
          <div className={styles.node}>
            <Field label={label} hint={help}>
              <Input
                disabled={disabled}
                value={currentText}
                onChange={(_, data) => {
                  const trimmed = data.value.trim();
                  if (!trimmed) {
                    setValue(path, undefined);
                    return;
                  }
                  const parsed = Number(trimmed);
                  if (!Number.isFinite(parsed)) return;
                  setValue(path, isInteger ? Math.trunc(parsed) : parsed);
                }}
              />
            </Field>
          </div>
        );
      }
      case "string": {
        const hint = hintForPath(path, hints);
        const placeholder = hint?.placeholder ?? "";
        const sensitive = hint?.sensitive ?? isSensitivePath(path);
        const enumValues = schemaEnum(node);
        const currentString = valueAsString(current ?? "");

        if (enumValues && enumValues.length > 0) {
          const selectedIndex = enumValues.findIndex((entry) =>
            compareLiteral(entry, current)
          );
          return (
            <div className={styles.node}>
              <Field label={label} hint={help}>
                <select
                  className={styles.select}
                  disabled={disabled}
                  value={selectedIndex >= 0 ? String(selectedIndex) : ""}
                  onChange={(event) => {
                    const index = Number.parseInt(event.target.value, 10);
                    if (
                      Number.isNaN(index) ||
                      index < 0 ||
                      index >= enumValues.length
                    ) {
                      setValue(path, undefined);
                    } else {
                      setValue(path, enumValues[index]);
                    }
                  }}
                >
                  <option value="">Select...</option>
                  {enumValues.map((entry, index) => (
                    <option key={String(index)} value={String(index)}>
                      {valueAsString(entry)}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          );
        }

        return (
          <div className={styles.node}>
            <Field label={label} hint={help}>
              <Input
                type={sensitive ? "password" : "text"}
                placeholder={placeholder}
                disabled={disabled}
                value={currentString}
                onChange={(_, data) => {
                  const trimmed = data.value.trim();
                  setValue(path, trimmed.length === 0 ? undefined : data.value);
                }}
              />
            </Field>
          </div>
        );
      }
      default:
        return (
          <div className={styles.node}>
            <Text weight="semibold">{label}</Text>
            {help && <Text className={styles.helper}>{help}</Text>}
            <Text className={styles.helper}>Unsupported field type.</Text>
          </div>
        );
    }
  };

  return <div className={styles.group}>{renderNode(schema, basePath)}</div>;
}
