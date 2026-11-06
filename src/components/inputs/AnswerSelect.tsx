"use client";

import type { ReactNode } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { selectTriggerClassName } from "@/components/ui/surfaces";

/** Same closed control for single-choice and select-all questions. */
export const answerSelectTriggerClassName = selectTriggerClassName;

export function AnswerSelect<T extends string | number>({
  label,
  value,
  options,
  onValueChange,
  renderOption,
}: {
  label: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onValueChange: (value: T) => void;
  renderOption?: (option: { value: T; label: string }) => ReactNode;
}) {
  return (
    <Select
      value={value}
      items={options}
      onValueChange={(next) => {
        if (next != null) onValueChange(next as T);
      }}
    >
      <SelectTrigger aria-label={label} className={answerSelectTriggerClassName}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={String(option.value)} value={option.value}>
            {renderOption ? renderOption(option) : option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function MultiAnswerSelect<T extends string>({
  label,
  value,
  options,
  emptyLabel,
  onValueChange,
  renderOption,
}: {
  label: string;
  value: readonly T[];
  options: ReadonlyArray<{ value: T; label: string }>;
  emptyLabel: string;
  onValueChange: (value: T[]) => void;
  renderOption?: (option: { value: T; label: string }) => ReactNode;
}) {
  const selected = [...value];

  return (
    <Select
      multiple
      value={selected}
      items={options}
      onValueChange={(next) => {
        if (next) onValueChange(next as T[]);
      }}
    >
      <SelectTrigger aria-label={label} className={answerSelectTriggerClassName}>
        <SelectValue>
          {(current: T[] | null) => {
            const picked = Array.isArray(current) ? current : [];
            if (picked.length === 0) return emptyLabel;
            return picked
              .map(
                (item) =>
                  options.find((option) => option.value === item)?.label ??
                  String(item)
              )
              .join(", ");
          }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {renderOption ? renderOption(option) : option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
