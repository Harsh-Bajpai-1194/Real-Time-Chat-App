import { render, screen } from '@testing-library/react';
import App from './App';

test('renders the join chat screen', () => {
  render(<App />);

  expect(screen.getByText(/join chat/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /join room/i })).toBeInTheDocument();
});
