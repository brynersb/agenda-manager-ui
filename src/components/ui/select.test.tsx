import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SelectField } from './select';

interface Item {
  id: number;
  name: string;
}

const ITEMS: Item[] = [
  { id: 1, name: 'Residencial Aurora' },
  { id: 2, name: 'Edifício Bora Centro' },
];

function renderSelect(
  overrides: Partial<Parameters<typeof SelectField<Item>>[0]> = {},
) {
  const onValueChange = vi.fn();

  render(
    <SelectField<Item>
      value={null}
      items={ITEMS}
      getLabel={(item) => item.name}
      getKey={(item) => String(item.id)}
      onValueChange={onValueChange}
      placeholder="Selecione o empreendimento"
      {...overrides}
    />,
  );

  return { onValueChange };
}

describe('<SelectField />', () => {
  it('mostra o placeholder sem seleção', () => {
    renderSelect();
    expect(screen.getByText('Selecione o empreendimento')).toBeInTheDocument();
  });

  it('lista todas as opções ao abrir, sem precisar digitar', async () => {
    renderSelect();

    await userEvent.click(
      screen.getByRole('combobox', { name: 'Selecione o empreendimento' }),
    );

    expect(
      screen.getByRole('option', { name: 'Residencial Aurora' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: 'Edifício Bora Centro' }),
    ).toBeInTheDocument();
  });

  it('devolve o item inteiro (não só a chave) ao escolher', async () => {
    const { onValueChange } = renderSelect();

    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.click(
      screen.getByRole('option', { name: 'Edifício Bora Centro' }),
    );

    expect(onValueChange).toHaveBeenCalledWith(ITEMS[1]);
  });

  it('exibe o rótulo do item selecionado', () => {
    renderSelect({ value: ITEMS[0] });
    expect(screen.getByRole('combobox')).toHaveTextContent(
      'Residencial Aurora',
    );
  });

  it('avisa quando não há opções', async () => {
    renderSelect({ items: [] });
    await userEvent.click(screen.getByRole('combobox'));
    expect(screen.getByText('Nenhuma opção disponível.')).toBeInTheDocument();
  });

  it('fica bloqueado e mostra o spinner durante o carregamento', () => {
    renderSelect({ isLoading: true });
    const combobox = screen.getByRole('combobox');
    expect(combobox).toBeDisabled();
    expect(combobox).toHaveAttribute('aria-busy', 'true');
  });

  it('marca o campo como inválido', () => {
    renderSelect({ 'aria-invalid': true });
    expect(screen.getByRole('combobox')).toBeInvalid();
  });
});
