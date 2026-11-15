import { useEffect, useId, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { CONTROL_CLASS, FieldError } from '@/components/ui/field-error';
import { Spinner } from '@/components/ui/spinner';
import {
  useCreateRegistry,
  useReactivateRegistry,
  useRegistries,
  useRenameRegistry,
} from '@/hooks/use-registries';
import { getApiErrorMessage, isCode } from '@/lib/api-error';
import type { Registry, RegistryKind } from '@/types/registry';
import { ArchiveRegistryModal } from './archive-registry-modal';

interface RegistrySectionProps {
  kind: RegistryKind;
  /** Título da seção ("Empreendimentos", "Responsáveis"). */
  title: string;
  /** Rótulo e placeholder do campo de adicionar. */
  newPlaceholder: string;
  /** Com `registry:write`; sem ele a seção é só leitura. */
  canWrite: boolean;
}

interface Edit {
  id: string;
  name: string;
  version: number;
}

const NAME_MAX = 80;

function isVersionConflictOrGone(e: unknown): boolean {
  return (
    isCode(e, 'ESTATE_DEVELOPMENT_VERSION_OUTDATED') ||
    isCode(e, 'OWNER_VERSION_OUTDATED') ||
    isCode(e, 'ESTATE_DEVELOPMENT_NOT_FOUND') ||
    isCode(e, 'OWNER_NOT_FOUND')
  );
}

/**
 * Seção do painel de cadastros: ativos com renomear e arquivar, campo de
 * adicionar e alternância de arquivados com reativar.
 *
 * Empreendimentos e responsáveis usam a mesma seção porque o contrato é o
 * mesmo. Com a alternância ligada, a lista vem com os arquivados e a tela
 * separa os dois grupos. Num conflito de versão ao renomear (ou cadastro que
 * sumiu), a edição é descartada e a lista recarregada, para a pessoa ver o
 * estado atual antes de tentar de novo.
 *
 * @param props.kind Recurso exibido.
 * @param props.title Título da seção.
 * @param props.newPlaceholder Texto do campo de adicionar.
 * @param props.canWrite Habilita adicionar, renomear, arquivar e reativar.
 * @returns A seção.
 */
export function RegistrySection({
  kind,
  title,
  newPlaceholder,
  canWrite,
}: RegistrySectionProps) {
  const titleId = useId();
  const [showArchived, setShowArchived] = useState(false);
  const list = useRegistries(kind, { includeArchived: showArchived });
  const create = useCreateRegistry(kind);
  const rename = useRenameRegistry(kind);
  const reactivate = useReactivateRegistry(kind);

  const [newName, setNewName] = useState('');
  const [newError, setNewError] = useState<string | null>(null);
  const [edit, setEdit] = useState<Edit | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [archiving, setArchiving] = useState<Registry | null>(null);
  const newRef = useRef<HTMLInputElement>(null);
  const editRef = useRef<HTMLInputElement>(null);
  const editingId = edit?.id;

  // Ao entrar em edição o foco vai para o campo: o teclado (Enter, Esc) passa
  // a valer sem precisar clicar nele.
  useEffect(() => {
    if (editingId) editRef.current?.focus();
  }, [editingId]);

  const active = (list.data ?? []).filter((r) => r.active);
  const archived = (list.data ?? []).filter((r) => !r.active);

  async function add() {
    const name = newName.trim();
    if (!name) {
      setNewError('Informe um nome.');
      newRef.current?.focus();
      return;
    }
    setNewError(null);
    try {
      await create.mutateAsync(name);
      setNewName('');
      setGeneralError(null);
      newRef.current?.focus();
    } catch (e) {
      setNewError(getApiErrorMessage(e));
    }
  }

  async function saveEdit() {
    if (!edit) return;
    const name = edit.name.trim();
    if (!name) {
      setEditError('Informe um nome.');
      return;
    }
    setEditError(null);
    try {
      await rename.mutateAsync({
        id: edit.id,
        name,
        version: edit.version,
      });
      setEdit(null);
      setGeneralError(null);
    } catch (e) {
      if (isVersionConflictOrGone(e)) {
        setEdit(null);
        setGeneralError(getApiErrorMessage(e));
        void list.refetch();
        return;
      }
      setEditError(getApiErrorMessage(e));
    }
  }

  async function reactivateRegistry(registry: Registry) {
    try {
      await reactivate.mutateAsync(registry.id);
      setGeneralError(null);
    } catch (e) {
      setGeneralError(getApiErrorMessage(e));
    }
  }

  function renderRow(registry: Registry) {
    if (edit?.id === registry.id) {
      const errorId = `${titleId}-erro-edicao`;
      return (
        <li key={registry.id} className="flex flex-col gap-1.5 py-2">
          <div className="flex flex-wrap gap-2">
            <input
              ref={editRef}
              type="text"
              aria-label={`Novo nome de ${registry.name}`}
              value={edit.name}
              maxLength={NAME_MAX}
              autoComplete="off"
              aria-invalid={editError !== null}
              aria-describedby={editError ? errorId : undefined}
              disabled={rename.isPending}
              onChange={(e) => {
                setEdit({ ...edit, name: e.target.value });
                setEditError(null);
              }}
              data-esc-local
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void saveEdit();
                } else if (e.key === 'Escape') {
                  setEdit(null);
                  setEditError(null);
                }
              }}
              className={`h-9 min-w-0 flex-1 ${CONTROL_CLASS} ${editError ? 'border-late bg-late-bg' : 'border-line-strong'}`}
            />
            <Button
              size="sm"
              loading={rename.isPending}
              onClick={() => void saveEdit()}
            >
              Salvar
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={rename.isPending}
              onClick={() => {
                setEdit(null);
                setEditError(null);
              }}
            >
              Cancelar
            </Button>
          </div>
          {editError && (
            <div role="alert">
              <FieldError id={errorId}>{editError}</FieldError>
            </div>
          )}
        </li>
      );
    }

    return (
      <li
        key={registry.id}
        className="flex flex-wrap items-center justify-between gap-2 py-2"
      >
        <span className="min-w-0 break-words">{registry.name}</span>
        {canWrite && (
          <span className="flex gap-1.5">
            {registry.active ? (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Renomear ${registry.name}`}
                  onClick={() => {
                    setEditError(null);
                    setEdit({
                      id: registry.id,
                      name: registry.name,
                      version: registry.version,
                    });
                  }}
                >
                  Renomear
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Arquivar ${registry.name}`}
                  onClick={() => setArchiving(registry)}
                >
                  Arquivar
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Reativar ${registry.name}`}
                disabled={reactivate.isPending}
                onClick={() => void reactivateRegistry(registry)}
              >
                Reativar
              </Button>
            )}
          </span>
        )}
      </li>
    );
  }

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-3 py-3">
      <h3
        id={titleId}
        className="m-0 font-bold font-display text-lg leading-tight"
      >
        {title}
      </h3>

      {list.isPending && <Spinner label={`Carregando ${title}`} />}

      {list.isError && (
        <div role="alert" className="flex flex-col items-start gap-2">
          <FieldError>{getApiErrorMessage(list.error)}</FieldError>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void list.refetch()}
          >
            Tentar de novo
          </Button>
        </div>
      )}

      {list.data &&
        (active.length > 0 ? (
          <ul className="m-0 flex list-none flex-col divide-y divide-line p-0">
            {active.map(renderRow)}
          </ul>
        ) : (
          <p className="m-0 text-muted text-sm">Nenhum cadastrado ainda.</p>
        ))}

      {generalError && (
        <div role="alert">
          <FieldError>{generalError}</FieldError>
        </div>
      )}

      {canWrite && (
        <div className="flex flex-col gap-1.5">
          <div className="flex gap-2">
            <input
              ref={newRef}
              type="text"
              aria-label={newPlaceholder}
              placeholder={newPlaceholder}
              value={newName}
              maxLength={NAME_MAX}
              autoComplete="off"
              aria-invalid={newError !== null}
              aria-describedby={newError ? `${titleId}-erro-novo` : undefined}
              disabled={create.isPending}
              onChange={(e) => {
                setNewName(e.target.value);
                setNewError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void add();
                }
              }}
              className={`h-[42px] min-w-0 flex-1 ${CONTROL_CLASS} ${newError ? 'border-late bg-late-bg' : 'border-line-strong'}`}
            />
            <Button loading={create.isPending} onClick={() => void add()}>
              Adicionar
            </Button>
          </div>
          {newError && (
            <div role="alert">
              <FieldError id={`${titleId}-erro-novo`}>{newError}</FieldError>
            </div>
          )}
        </div>
      )}

      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={showArchived}
          onChange={(e) => setShowArchived(e.target.checked)}
          className="size-4 accent-accent"
        />
        Mostrar arquivados
      </label>

      {showArchived && list.data && (
        <div className="flex flex-col gap-1">
          <h4 className="m-0 font-semibold text-muted text-sm">Arquivados</h4>
          {archived.length > 0 ? (
            <ul className="m-0 flex list-none flex-col divide-y divide-line p-0">
              {archived.map(renderRow)}
            </ul>
          ) : (
            <p className="m-0 text-muted text-sm">Nenhum arquivado.</p>
          )}
        </div>
      )}

      <ArchiveRegistryModal
        kind={kind}
        registry={archiving}
        onClose={() => setArchiving(null)}
      />
    </section>
  );
}
