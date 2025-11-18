import React from 'react';

function OnlineUsers({ onlineUsers, myUserId, onSelectUser }) {
    // onlineUsers este un obiect de forma { userId: 'username' }
    // Vrem sa il transformam intr-un array
    const usersArray = Object.entries(onlineUsers);

    return (
        <div className="list-container">
            <h3>Utilizatori Online</h3>
            <ul>
                {usersArray.length > 1 ? usersArray.map(([userId, username]) => {
                    if (parseInt(userId, 10) === myUserId) {
                        return null; 
                    }
                    return (
                        <li key={userId} onClick={() => onSelectUser(userId)}>
                            {username}
                        </li>
                    );
                }) : <li>(Doar tu ești online)</li>}
            </ul>
        </div>
    );
}

export default OnlineUsers;
