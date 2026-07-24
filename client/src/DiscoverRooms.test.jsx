import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import DiscoverRooms from './DiscoverRooms';

describe('DiscoverRooms', () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ name: 'Test Room', desc: 'A room for testing', memberCount: 1, totalMessages: 5, icon: '🧪' }]),
    });
    window.fetch = global.fetch;
  });

  it('calls joinChatRoom with user email and picture when joining a room', async () => {
    // 1. Setup: Create a mock function and define user details
    const joinChatRoomMock = jest.fn();
    const user = {
      username: 'TestUser',
      email: 'test@google.com',
      picture: 'https://example.com/avatar.jpg',
    };

    // 2. Render the component with the necessary props
    render(
      <DiscoverRooms
        joinChatRoom={joinChatRoomMock}
        onClose={() => {}}
        onJoin={() => {}}
        username={user.username}
        email={user.email}
        picture={user.picture}
        roomsSignature={Date.now()}
        onOpenSettings={() => {}}
      />
    );

    // 3. Action: Find and click the "Join Room" button
    const joinButton = await screen.findByRole('button', { name: /join room/i });
    fireEvent.click(joinButton);

    // 4. Assertion: Verify that our mock function was called with the correct data
    expect(joinChatRoomMock).toHaveBeenCalledWith('Test Room', user.username, user.email, user.picture);
  });

  it('opens room settings from the settings button', async () => {
    const onOpenSettingsMock = jest.fn();

    render(
      <DiscoverRooms
        joinChatRoom={() => {}}
        onClose={() => {}}
        onJoin={() => {}}
        username="TestUser"
        email="test@google.com"
        picture="https://example.com/avatar.jpg"
        roomsSignature={Date.now()}
        onOpenSettings={onOpenSettingsMock}
      />
    );

    const settingsButton = await screen.findByRole('button', { name: /room settings/i });
    fireEvent.click(settingsButton);

    expect(onOpenSettingsMock).toHaveBeenCalledWith('Test Room');
  });
});