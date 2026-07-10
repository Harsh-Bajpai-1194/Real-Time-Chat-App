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

// Mock socket.io-client
jest.mock('socket.io-client', () => ({
  __esModule: true,
  default: jest.fn(),
}));

// Mock room data that the API would return
const mockRooms = [
  { name: 'Tech Talk', desc: 'Discuss latest tech trends...', icon: '💻', memberCount: 5, totalMessages: 10 },
  { name: 'Gaming Lair', desc: 'Community for gamers...', icon: '🎮', memberCount: 10, totalMessages: 25 },
];

beforeEach(() => {
  // Reset mocks and localStorage before each test
  localStorage.clear();
  mockSocket.connected = true;
  mockSocket.on.mockClear();
  mockSocket.off.mockClear();
  mockSocket.emit.mockClear();
  mockSocket.disconnect.mockClear();
  io.mockReturnValue(mockSocket);

  // Mock the global fetch API
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve(mockRooms),
    })
  );
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

  // Wait for rooms to be fetched and displayed
  const techTalkCard = await screen.findByText(/tech talk/i);
  expect(techTalkCard).toBeInTheDocument();

  // Join the first room
  await userEvent.click(screen.getAllByRole('button', { name: /join room/i })[0]);

  await waitFor(() => {
    expect(screen.getByText(/room: tech talk/i)).toBeInTheDocument();
  });
});

test('asks for confirmation before switching rooms from discovered rooms', async () => {
  render(<App />);

  await userEvent.click(screen.getByRole('button', { name: /join as a guest user/i }));
  await userEvent.click(screen.getByRole('button', { name: /discover rooms/i }));

  // Wait for rooms to be fetched and displayed and join the first one
  await screen.findByText(/tech talk/i);
  await userEvent.click(screen.getAllByRole('button', { name: /join room/i })[0]);

  // Wait for the main chat view to render
  await waitFor(() => {
    expect(screen.getByText(/room: tech talk/i)).toBeInTheDocument();
  });

  // Open discover rooms again to switch
  await userEvent.click(screen.getByRole('button', { name: /discover rooms/i }));

  // Wait for rooms to be displayed again
  const gamingLairCard = await screen.findByText(/gaming lair/i);
  await userEvent.click(within(gamingLairCard.closest('.room-card')).getByRole('button', { name: /join room/i }));

  // Check for confirmation popup
  expect(await screen.findByText(/are you sure you want to join this room/i)).toBeInTheDocument();

  // Confirm the switch
  await userEvent.click(screen.getByRole('button', { name: /yes, join room/i }));

  await waitFor(() => {
    expect(screen.getByText(/room: gaming lair/i)).toBeInTheDocument();
  });
});
