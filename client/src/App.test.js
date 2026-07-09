import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import io from 'socket.io-client';

const mockSocket = {
  connected: true,
  on: jest.fn(),
  off: jest.fn(),
  emit: jest.fn(),
  disconnect: jest.fn(),
};

jest.mock('socket.io-client', () => ({
  __esModule: true,
  default: jest.fn(),
}));

beforeEach(() => {
  localStorage.clear();
  mockSocket.connected = true;
  mockSocket.on.mockClear();
  mockSocket.off.mockClear();
  mockSocket.emit.mockClear();
  mockSocket.disconnect.mockClear();
  io.mockReturnValue(mockSocket);
});

test('renders the join chat screen', () => {
  render(<App />);

  expect(screen.getByText(/join chat/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /join as a guest user/i })).toBeInTheDocument();
});

test('shows the selected room name after joining from discovered rooms', async () => {
  render(<App />);

  await userEvent.click(screen.getByRole('button', { name: /join as a guest user/i }));
  await userEvent.click(screen.getByRole('button', { name: /discover rooms/i }));
  await userEvent.click(screen.getAllByRole('button', { name: /join room/i })[0]);

  await waitFor(() => {
    expect(screen.getByText(/room: tech talk/i)).toBeInTheDocument();
  });
});

test('asks for confirmation before switching rooms from discovered rooms', async () => {
  render(<App />);

  await userEvent.click(screen.getByRole('button', { name: /join as a guest user/i }));
  await userEvent.click(screen.getByRole('button', { name: /discover rooms/i }));
  await userEvent.click(screen.getAllByRole('button', { name: /join room/i })[0]);

  await userEvent.click(screen.getByRole('button', { name: /discover rooms/i }));

  const gamingLairCard = screen.getByText(/gaming lair/i).closest('.room-card');
  await userEvent.click(within(gamingLairCard).getByRole('button', { name: /join room/i }));

  expect(screen.getByText(/are you sure you want to join this room/i)).toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: /yes, join room/i }));

  await waitFor(() => {
    expect(screen.getByText(/room: gaming lair/i)).toBeInTheDocument();
  });
});
