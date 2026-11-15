import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Field } from './field';
import { TextInput } from './text-input';
import { Textarea } from './textarea';

describe('<Field />', () => {
  it('liga o rótulo ao controle pelo id', () => {
    render(
      <Field label="Título">{(control) => <TextInput {...control} />}</Field>,
    );

    expect(screen.getByLabelText('Título')).toBeInTheDocument();
  });

  it('mostra o erro, marca o controle como inválido e o descreve pelo erro', () => {
    render(
      <Field label="Título" error="Informe o título.">
        {(control) => <TextInput {...control} />}
      </Field>,
    );

    const input = screen.getByLabelText('Título');
    expect(input).toBeInvalid();
    expect(input).toHaveAccessibleDescription('Informe o título.');
    expect(input).toHaveClass('border-late');
  });

  it('sem erro o controle é válido e a ajuda o descreve', () => {
    render(
      <Field label="Título" help="Até 140 caracteres.">
        {(control) => <TextInput {...control} />}
      </Field>,
    );

    const input = screen.getByLabelText('Título');
    expect(input).toBeValid();
    expect(input).toHaveAccessibleDescription('Até 140 caracteres.');
  });

  it('exibe o contador de caracteres e o destaca ao passar do limite', () => {
    const { rerender } = render(
      <Field label="Sobre" counter={{ current: 12, max: 1200 }}>
        {(control) => <Textarea {...control} />}
      </Field>,
    );
    expect(screen.getByText('12/1200')).toHaveClass('text-muted');

    rerender(
      <Field label="Sobre" counter={{ current: 1201, max: 1200 }}>
        {(control) => <Textarea {...control} />}
      </Field>,
    );
    expect(screen.getByText('1201/1200')).toHaveClass('text-late');
  });
});
