import React from 'react';

function OnlineUsers({ onlineUsers, myUserId, onSelectUser }) {
    // onlineUsers = { userId: username }
    const filteredUsers = Object.entries(onlineUsers)
        .filter(([userId]) => Number(userId) !== myUserId);

    return (
        <div className="list-section">
            <h3>Utilizatori Online ({filteredUsers.length})</h3>
            <ul>
                {filteredUsers.length > 0 ? (
                    filteredUsers.map(([userId, username]) => (
                        <li
                            key={userId}
                            onClick={() => onSelectUser(username)} // 🔥 TRIMITEM USERNAME
                            style={{ cursor: 'pointer' }}
                        >
                            {username}
                            <span style={{ color: '#4ecca3', marginLeft: '6px' }}>●</span>
                        </li>
                    ))
                ) : (
                    <li style={{ color: 'var(--text-secondary)' }}>
                        (Doar tu ești online)
                    </li>
                )}
            </ul>
        </div>
    );
}

export default OnlineUsers;
