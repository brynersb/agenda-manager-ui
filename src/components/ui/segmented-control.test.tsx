import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SegmentedControl } from './segmented-control';

const OPTIONS = [
  { value: 'dueDate', label: 'Por prazo' },
  { value: 'status', label: 'Por status' },
] as const;

describe('<SegmentedControl />', () => {
  it('marca só a opção selecionada com aria-pressed', () => {
    render(
      <SegmentedControl
        label="Agrupar pautas"
        options={[...OPTIONS]}
        value="dueDate"
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('group', { name: 'Agrupar pautas' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Por prazo' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Por status' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('devolve o valor da opção clicada', async () => {
    const onChange = vi.fn();
    render(
      <SegmentedControl
        label="Agrupar pautas"
        options={[...OPTIONS]}
        value="dueDate"
        onChange={onChange}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Por status' }));
    expect(onChange).toHaveBeenCalledWith('status');
  });
});
