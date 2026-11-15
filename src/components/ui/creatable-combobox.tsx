import { Check, ChevronDown } from 'lucide-react';
import type { KeyboardEvent } from 'react';
import { useEffect, useId, useRef, useState } from 'react';

import { getApiErrorMessage } from '@/lib/api-error';
import { removeAccents } from '@/lib/text';
import { Button } from './button';
import { CONTROL_CLASS, FieldError } from './field-error';

/** Opção do seletor: um cadastro reduzido ao que o campo precisa. */
export interface CreatableOption {
  id: string;
  name: string;
  active: boolean;
}

interface CreatableComboboxProps {
  /** Rótulo visível do campo, ligado ao controle por `htmlFor`. */
  label: string;
  /**
   * Opções conhecidas. Para o valor atual aparecer mesmo arquivado, a lista
   * precisa incluir os arquivados (`useRegistries(kind, { includeArchived })`).
   */
  options: CreatableOption[];
  /** Id selecionado, ou `null` para "none". */
  value: string | null;
  onChange: (id: string | null) => void;
  /** Texto da opção que limpa o campo ("Nenhum", "Sem responsável"). */
  noneLabel: string;
  /** Oferece "+ Adicionar novo…"; só quem tem `registry:write`. */
  canCreate: boolean;
  /** Cria o cadastro na API; rejeita com o erro da API (ex.: duplicado). */
  onCreate: (name: string) => Promise<{ id: string; name: string }>;
  newPlaceholder: string;
  maxLength?: number;
  disabled?: boolean;
}

type Item =
  | { kind: 'none'; key: string; text: string; selected: boolean }
  | {
      kind: 'option';
      key: string;
      text: string;
      selected: boolean;
      id: string;
    }
  | { kind: 'new'; key: string; text: string; selected: boolean };

const NEW_TEXT = '+ Adicionar novo…';

function optionLabel(option: CreatableOption): string {
  return option.active ? option.name : `${option.name} (arquivado)`;
}

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

/**
 * Seletor com busca sem acento e criação inline de cadastro.
 *
 * Lista só os ativos; um arquivado só aparece quando é o valor atual da pauta
 * ("Nome (arquivado)"), para que a pauta antiga continue exibindo o que tem
 * sem oferecer o nome a outras pautas. "+ Adicionar novo…" troca o seletor por
 * um campo de texto: Enter cria pela API e já seleciona o novo. Se o nome
 * digitado já existe entre os ativos (sem caixa nem acento), seleciona o
 * existente em vez de duplicar. Um homônimo arquivado vai até a API, que
 * responde `*_NAME_DUPLICATED` orientando a reativá-lo.
 *
 * Teclado: setas navegam, Enter escolhe, Esc fecha a lista (ou cancela a
 * criação).
 *
 * @param props.label Rótulo visível.
 * @param props.options Cadastros disponíveis.
 * @param props.value Id selecionado, ou `null`.
 * @param props.onChange Recebe o id escolhido, ou `null` em "none".
 * @param props.noneLabel Texto da opção vazia.
 * @param props.canCreate Habilita "+ Adicionar novo…".
 * @param props.onCreate Cria o cadastro e devolve `{ id, name }`.
 * @param props.newPlaceholder Placeholder do campo de nome novo.
 * @param props.maxLength Limite de caracteres do nome novo; padrão 80.
 * @param props.disabled Bloqueia o campo.
 * @returns O campo.
 */
export function CreatableCombobox({
  label,
  options,
  value,
  onChange,
  noneLabel,
  canCreate,
  onCreate,
  newPlaceholder,
  maxLength = 80,
  disabled = false,
}: CreatableComboboxProps) {
  const baseId = useId();
  const listboxId = `${baseId}-lista`;
  const errorId = `${baseId}-erro`;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const newRef = useRef<HTMLInputElement>(null);
  const returnFocus = useRef(false);

  useEffect(() => {
    if (creating) newRef.current?.focus();
  }, [creating]);

  useEffect(() => {
    if (!creating && returnFocus.current) {
      returnFocus.current = false;
      inputRef.current?.focus();
    }
  }, [creating]);

  const selected = options.find((o) => o.id === value);
  const selectedText = selected
    ? optionLabel(selected)
    : value === null
      ? noneLabel
      : '';

  const term = removeAccents(query.trim());
  const items: Item[] = [];
  if (term === '') {
    items.push({
      kind: 'none',
      key: 'none',
      text: noneLabel,
      selected: value === null,
    });
  }
  for (const option of options) {
    if (!option.active && option.id !== value) continue;
    if (!removeAccents(option.name).includes(term)) continue;
    items.push({
      kind: 'option',
      key: option.id,
      text: optionLabel(option),
      selected: option.id === value,
      id: option.id,
    });
  }
  if (canCreate) {
    items.push({
      kind: 'new',
      key: 'new',
      text: NEW_TEXT,
      selected: false,
    });
  }

  const active = Math.min(activeIndex, items.length - 1);

  function closeList() {
    setOpen(false);
    setQuery('');
    setActiveIndex(0);
  }

  function choose(item: Item) {
    if (item.kind === 'new') {
      closeList();
      setNewName('');
      setError(null);
      setCreating(true);
      return;
    }
    onChange(item.kind === 'option' ? item.id : null);
    closeList();
  }

  function handleType(text: string) {
    setQuery(text);
    setOpen(true);
    setActiveIndex(0);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      setActiveIndex(active < items.length - 1 ? active + 1 : 0);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      setActiveIndex(active > 0 ? active - 1 : items.length - 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = items[active];
      if (open && item) choose(item);
      else setOpen(true);
    } else if (e.key === 'Escape' && open) {
      e.preventDefault();
      e.stopPropagation();
      closeList();
    }
  }

  function cancelCreate() {
    setCreating(false);
    setError(null);
    returnFocus.current = true;
  }

  async function create() {
    const name = normalizeName(newName);
    if (!name) {
      setError('Informe um nome.');
      return;
    }

    const existing = options.find(
      (o) => o.active && removeAccents(o.name) === removeAccents(name),
    );
    if (existing) {
      onChange(existing.id);
      cancelCreate();
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const created = await onCreate(name);
      onChange(created.id);
      cancelCreate();
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  function handleNewKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      void create();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      cancelCreate();
    }
  }

  if (creating) {
    return (
      <div className="flex min-w-0 flex-col gap-1.5">
        <label
          htmlFor={`${baseId}-novo`}
          className="font-semibold text-[13px] leading-tight"
        >
          {label}
        </label>
        <div className="flex flex-wrap gap-2">
          <input
            id={`${baseId}-novo`}
            ref={newRef}
            type="text"
            value={newName}
            maxLength={maxLength}
            disabled={saving}
            placeholder={newPlaceholder}
            autoComplete="off"
            aria-invalid={error !== null}
            aria-describedby={error ? errorId : undefined}
            onChange={(e) => {
              setNewName(e.target.value);
              setError(null);
            }}
            onKeyDown={handleNewKeyDown}
            data-esc-local
            className={`h-[42px] min-w-[10rem] flex-1 ${CONTROL_CLASS} ${error ? 'border-late bg-late-bg' : 'border-line-strong'}`}
          />
          <Button
            variant="primary"
            loading={saving}
            onClick={() => void create()}
          >
            Adicionar
          </Button>
          <Button variant="secondary" disabled={saving} onClick={cancelCreate}>
            Cancelar
          </Button>
        </div>
        {error && (
          <div role="alert">
            <FieldError id={errorId}>{error}</FieldError>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative flex min-w-0 flex-col gap-1.5">
      <label
        htmlFor={`${baseId}-campo`}
        className="font-semibold text-[13px] leading-tight"
      >
        {label}
      </label>
      <div className="relative">
        <input
          id={`${baseId}-campo`}
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={
            open && items[active] ? `${baseId}-op-${active}` : undefined
          }
          autoComplete="off"
          disabled={disabled}
          value={open ? query : selectedText}
          placeholder={open ? selectedText : undefined}
          onChange={(e) => handleType(e.target.value)}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          data-esc-local={open || undefined}
          onBlur={closeList}
          className={`h-[42px] pr-9 ${CONTROL_CLASS} border-line-strong`}
        />
        <ChevronDown
          className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted"
          aria-hidden="true"
        />
      </div>
      {open && items.length === 0 && (
        <p className="absolute top-full right-0 left-0 z-10 m-0 mt-1 rounded-lg border border-line-strong bg-surface px-3 py-2.5 text-muted text-sm shadow-float">
          Nenhum resultado.
        </p>
      )}
      {open && items.length > 0 && (
        <div
          id={listboxId}
          role="listbox"
          aria-label={label}
          className="absolute top-full right-0 left-0 z-10 mt-1 max-h-60 overflow-y-auto rounded-lg border border-line-strong bg-surface p-1 shadow-float"
        >
          {items.map((item, i) => (
            <button
              key={item.key}
              type="button"
              id={`${baseId}-op-${i}`}
              role="option"
              aria-selected={item.selected}
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActiveIndex(i)}
              onClick={() => choose(item)}
              className={`flex w-full cursor-pointer items-center justify-between gap-3 rounded-md border-0 bg-transparent px-3 py-2 text-left text-ink text-sm ${
                i === active ? 'bg-hover' : ''
              } ${item.kind === 'new' ? 'font-semibold text-accent' : ''}`}
            >
              <span className="truncate">{item.text}</span>
              {item.selected && (
                <Check
                  className="size-4 shrink-0 text-accent"
                  aria-hidden="true"
                />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
