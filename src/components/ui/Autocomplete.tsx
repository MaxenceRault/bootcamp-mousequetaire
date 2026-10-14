"use client";

import { useId, useState, type ComponentProps, type KeyboardEvent } from "react";

export type Suggestion = { key: string; label: string };

type AutocompleteProps = Omit<ComponentProps<"input">, "value" | "onChange" | "onSelect"> & {
  value: string;
  onValueChange: (value: string) => void;
  suggestions: Suggestion[];
  onSelect: (suggestion: Suggestion) => void;
};

// Champ texte avec liste de suggestions sous la saisie (motif ARIA « combobox ») :
// flèches haut/bas pour naviguer, Entrée pour choisir, Échap pour fermer.
// Le style du champ est laissé à l'appelant (className).
export function Autocomplete({
  value,
  onValueChange,
  suggestions,
  onSelect,
  className = "",
  onFocus,
  onBlur,
  onKeyDown,
  ...props
}: AutocompleteProps) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const expanded = open && suggestions.length > 0;
  const activeIndex = active < suggestions.length ? active : -1;

  function select(suggestion: Suggestion) {
    onSelect(suggestion);
    setOpen(false);
    setActive(-1);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    onKeyDown?.(event);

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActive(Math.min(activeIndex + 1, suggestions.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive(Math.max(activeIndex - 1, 0));
    } else if (event.key === "Enter" && expanded && activeIndex >= 0) {
      // Entrée choisit la suggestion au lieu d'envoyer le formulaire.
      event.preventDefault();
      select(suggestions[activeIndex]);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="relative w-full">
      <input
        {...props}
        type="text"
        role="combobox"
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-activedescendant={expanded && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
        value={value}
        onChange={(event) => {
          onValueChange(event.currentTarget.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={(event) => {
          onFocus?.(event);
          setOpen(true);
        }}
        onBlur={(event) => {
          onBlur?.(event);
          setOpen(false);
        }}
        onKeyDown={handleKeyDown}
        className={className}
      />
      {expanded && (
        <ul
          id={listId}
          role="listbox"
          className="absolute top-full left-0 z-20 mt-2 max-h-64 w-full min-w-64 overflow-auto rounded-lg border border-line bg-surface p-1 shadow-lg"
        >
          {suggestions.map((suggestion, index) => (
            <li
              key={suggestion.key}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              // mousedown empêché : le champ garde le focus, la liste ne se ferme pas avant le clic.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => select(suggestion)}
              className={`cursor-pointer truncate rounded-lg px-3 py-2 text-body-md text-ink ${
                index === activeIndex ? "bg-surface-muted" : "hover:bg-surface-muted"
              }`}
            >
              {suggestion.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
