import type { FormEvent, RefObject } from 'react';
import { useEffect } from 'react';

import {
  CreatableCombobox,
  type CreatableOption,
} from '@/components/ui/creatable-combobox';
import { Field } from '@/components/ui/field';
import { FieldError } from '@/components/ui/field-error';
import { NativeSelect, type SelectOption } from '@/components/ui/native-select';
import { TextInput } from '@/components/ui/text-input';
import { Textarea } from '@/components/ui/textarea';
import {
  ACTION_LABEL,
  ACTION_ORDER,
  CHANNEL_LABEL,
  CHANNEL_ORDER,
  STATUS_LABEL,
  STATUS_ORDER,
} from '@/lib/labels';
import type { RegistryKind } from '@/types/registry';
import {
  type ContentBriefErrors,
  type ContentBriefValues,
  DESCRIPTION_MAX,
  TITLE_MAX,
} from './content-brief-values';
import { DueDateShortcuts } from './due-date-shortcuts';

interface ContentBriefFormProps {
  /** Id do `<form>`; o botão "Salvar" do rodapé o referencia por `form=`. */
  id: string;
  values: ContentBriefValues;
  onChange: (partial: Partial<ContentBriefValues>) => void;
  errors: ContentBriefErrors;
  /** Sem `content-brief:write` nenhum campo aceita alteração. */
  readOnly: boolean;
  estateDevelopments: CreatableOption[];
  owners: CreatableOption[];
  /** `registry:write`: oferece "+ Adicionar novo…" nos dois seletores. */
  canCreateRegistry: boolean;
  /** Cria o cadastro na hora (antes de salvar a pauta). */
  onCreateRegistry: (
    kind: RegistryKind,
    name: string,
  ) => Promise<{ id: string; name: string }>;
  onSubmit: () => void;
  /** Para o editor levar o foco ao título (pauta nova ou título inválido). */
  titleRef: RefObject<HTMLInputElement | null>;
  /** Leva o foco ao título ao montar (pauta nova). */
  focusTitle?: boolean;
}

const ACTION_OPTIONS: SelectOption[] = [
  { value: '', label: 'Sem ação' },
  ...ACTION_ORDER.map((a) => ({ value: a, label: ACTION_LABEL[a] })),
];

const CHANNEL_OPTIONS: SelectOption[] = [
  { value: '', label: 'Nenhum' },
  ...CHANNEL_ORDER.map((c) => ({ value: c, label: CHANNEL_LABEL[c] })),
];

const STATUS_OPTIONS: SelectOption[] = STATUS_ORDER.map((s) => ({
  value: s,
  label: STATUS_LABEL[s],
}));

/**
 * Campos do editor de pauta (equivalente ao `<form id="form">` do protótipo).
 *
 * Só apresenta: o estado, a validação e o envio ficam no
 * `ContentBriefEditorDrawer`. Empreendimento e responsável ficam lado a lado a
 * partir de 720 px de tela; abaixo disso, empilhados.
 *
 * @param props.values Valores atuais.
 * @param props.onChange Recebe o que mudou.
 * @param props.errors Mensagens por campo.
 * @param props.readOnly Bloqueia a edição de todos os campos.
 * @param props.onSubmit Chamado no submit (Enter num campo ou "Salvar").
 * @param props.focusTitle Foca o título ao abrir.
 * @returns O formulário.
 */
export function ContentBriefForm({
  id,
  values,
  onChange,
  errors,
  readOnly,
  estateDevelopments,
  owners,
  canCreateRegistry,
  onCreateRegistry,
  onSubmit,
  titleRef,
  focusTitle = false,
}: ContentBriefFormProps) {
  useEffect(() => {
    if (focusTitle) titleRef.current?.focus();
  }, [focusTitle, titleRef]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit();
  }

  return (
    <form
      id={id}
      noValidate
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 pb-2"
    >
      <Field
        label="Título"
        error={errors.title}
        counter={{ current: values.title.length, max: TITLE_MAX }}
      >
        {(control) => (
          <TextInput
            {...control}
            ref={titleRef}
            value={values.title}
            maxLength={TITLE_MAX}
            readOnly={readOnly}
            autoComplete="off"
            placeholder="Ex.: Criar arte do plantão de vendas"
            onChange={(e) => onChange({ title: e.target.value })}
          />
        )}
      </Field>

      <Field
        label="Sobre o que se trata"
        error={errors.description}
        counter={{ current: values.description.length, max: DESCRIPTION_MAX }}
      >
        {(control) => (
          <Textarea
            {...control}
            value={values.description}
            maxLength={DESCRIPTION_MAX}
            readOnly={readOnly}
            placeholder="Objetivo, público e o que precisa estar no material"
            onChange={(e) => onChange({ description: e.target.value })}
          />
        )}
      </Field>

      <div className="grid gap-4 min-[720px]:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-1.5">
          <CreatableCombobox
            label="Empreendimento"
            options={estateDevelopments}
            value={values.estateDevelopmentId}
            onChange={(estateDevelopmentId) =>
              onChange({ estateDevelopmentId })
            }
            noneLabel="Nenhum"
            canCreate={canCreateRegistry && !readOnly}
            onCreate={(name) => onCreateRegistry('estate-developments', name)}
            newPlaceholder="Nome do empreendimento"
            disabled={readOnly}
          />
          {errors.estateDevelopmentId && (
            <FieldError>{errors.estateDevelopmentId}</FieldError>
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <CreatableCombobox
            label="Responsável"
            options={owners}
            value={values.ownerId}
            onChange={(ownerId) => onChange({ ownerId })}
            noneLabel="Sem responsável"
            canCreate={canCreateRegistry && !readOnly}
            onCreate={(name) => onCreateRegistry('owners', name)}
            newPlaceholder="Nome da pessoa"
            disabled={readOnly}
          />
          {errors.ownerId && <FieldError>{errors.ownerId}</FieldError>}
        </div>
      </div>

      <div className="grid gap-4 min-[720px]:grid-cols-2">
        <Field label="Ação" error={errors.action}>
          {(control) => (
            <NativeSelect
              control={control}
              value={values.action}
              options={ACTION_OPTIONS}
              disabled={readOnly}
              onChange={(action) =>
                onChange({ action: action as ContentBriefValues['action'] })
              }
            />
          )}
        </Field>
        <Field label="Canal" error={errors.channel}>
          {(control) => (
            <NativeSelect
              control={control}
              value={values.channel}
              options={CHANNEL_OPTIONS}
              disabled={readOnly}
              onChange={(channel) =>
                onChange({ channel: channel as ContentBriefValues['channel'] })
              }
            />
          )}
        </Field>
      </div>

      <Field label="Prazo" error={errors.dueDate}>
        {(control) => (
          <div className="flex flex-wrap items-center gap-2">
            <TextInput
              {...control}
              type="date"
              value={values.dueDate}
              disabled={readOnly}
              className="w-auto min-w-[10.5rem]"
              onChange={(e) => onChange({ dueDate: e.target.value })}
            />
            <DueDateShortcuts
              disabled={readOnly}
              onPick={(dueDate) => onChange({ dueDate })}
            />
          </div>
        )}
      </Field>

      <Field label="Status" error={errors.status}>
        {(control) => (
          <NativeSelect
            control={control}
            value={values.status}
            options={STATUS_OPTIONS}
            disabled={readOnly}
            onChange={(status) =>
              onChange({ status: status as ContentBriefValues['status'] })
            }
          />
        )}
      </Field>
    </form>
  );
}
