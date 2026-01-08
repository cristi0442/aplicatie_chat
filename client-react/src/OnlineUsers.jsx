import React from 'react';

function OnlineUsers({ onlineUsers, myUserId, onSelectUser }) {
    const filteredUsers = Object.entries(onlineUsers)
        .filter(([userId, username]) => parseInt(userId, 10) !== myUserId);

    return (
        <div className="list-section">
            <h3>Utilizatori Online ({filteredUsers.length})</h3>
            <ul>
                {/* Afiseaza lista filtrata */}
                {filteredUsers.length > 0 ? filteredUsers.map(([userId, username]) => {
                    return (
                        <li key={userId} onClick={() => onSelectUser(userId)}>
                            {username}
                            <span style={{color: '#4ecca3', marginLeft: '5px'}}>●</span>
                        </li>
                    );
                }) : <li style={{ color: 'var(--text-secondary)' }}>(Doar tu ești online)</li>}
            </ul>
        </div>
    );
}

export default OnlineUsers;
