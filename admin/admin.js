// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyD44h0Uak9EeQs2A_aAfSvyRKT4jgdSuHg",
    authDomain: "jtimwiki.firebaseapp.com",
    projectId: "jtimwiki",
    storageBucket: "jtimwiki.firebasestorage.app",
    messagingSenderId: "125581944053",
    appId: "1:125581944053:web:e314fcdd288daf97c1d1bc",
    measurementId: "G-WNVG1L3CZK"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// DOM Elements
const adminName = document.getElementById('adminName');
const logoutBtn = document.getElementById('logoutBtn');
const totalUsers = document.getElementById('totalUsers');
const totalStudents = document.getElementById('totalStudents');
const totalKids = document.getElementById('totalKids');
const totalAdmins = document.getElementById('totalAdmins');
const usersTableBody = document.getElementById('usersTableBody');
const addUserBtn = document.getElementById('addUserBtn');
const userModal = document.getElementById('userModal');
const deleteModal = document.getElementById('deleteModal');
const userForm = document.getElementById('userForm');
const modalTitle = document.getElementById('modalTitle');
const closeModal = document.getElementById('closeModal');
const closeDeleteModal = document.getElementById('closeDeleteModal');
const cancelBtn = document.getElementById('cancelBtn');
const saveUserBtn = document.getElementById('saveUserBtn');
const cancelDelete = document.getElementById('cancelDelete');
const confirmDelete = document.getElementById('confirmDelete');
const userToDeleteInfo = document.getElementById('userToDeleteInfo');
const loadingSpinner = document.getElementById('loadingSpinner');

// Global variables
let currentUser = null;
let editingUserId = null;
let userToDelete = null;

// Check authentication and admin role
auth.onAuthStateChanged(async (user) => {
    if (user) {
        try {
            const userDoc = await db.collection('students').doc(user.uid).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                if (userData.role === 'admin') {
                    currentUser = user;
                    adminName.textContent = userData.name;
                    loadDashboard();
                    loadUsers();
                } else {
                    // Redirect non-admin users
                    window.location.href = '../index.html';
                }
            } else {
                window.location.href = '../index.html';
            }
        } catch (error) {
            console.error('Error checking user role:', error);
            window.location.href = '../index.html';
        }
    } else {
        window.location.href = '../index.html';
    }
});

// Load dashboard statistics
async function loadDashboard() {
    try {
        const snapshot = await db.collection('students').get();
        let users = 0, students = 0, kids = 0, admins = 0;
        
        snapshot.forEach(doc => {
            const userData = doc.data();
            users++;
            
            if (userData.role === 'student') students++;
            else if (userData.role === 'kid') kids++;
            else if (userData.role === 'admin') admins++;
        });
        
        totalUsers.textContent = users;
        totalStudents.textContent = students;
        totalKids.textContent = kids;
        totalAdmins.textContent = admins;
    } catch (error) {
        console.error('Error loading dashboard:', error);
        showNotification('Error loading dashboard statistics', 'error');
    }
}

// Load users table
async function loadUsers() {
    showLoading(true);
    try {
        const snapshot = await db.collection('students').orderBy('createdAt', 'desc').get();
        usersTableBody.innerHTML = '';
        
        if (snapshot.empty) {
            usersTableBody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 40px; color: var(--gray);">
                        <i class="fas fa-users" style="font-size: 48px; margin-bottom: 10px; display: block;"></i>
                        <p>No users found</p>
                    </td>
                </tr>
            `;
            return;
        }
        
        snapshot.forEach(doc => {
            const userData = doc.data();
            const row = document.createElement('tr');
            
            // Format date
            const regDate = userData.createdAt ? 
                userData.createdAt.toDate().toLocaleDateString() : 'N/A';
            
            row.innerHTML = `
                <td>${userData.name}</td>
                <td>${userData.email}</td>
                <td><span class="role-badge ${userData.role}">${userData.role}</span></td>
                <td>${regDate}</td>
                <td><span class="status-badge active">Active</span></td>
                <td>
                    <div class="action-buttons">
                        <button class="action-btn edit-btn" data-id="${doc.id}">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button class="action-btn delete-btn" data-id="${doc.id}">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                </td>
            `;
            
            usersTableBody.appendChild(row);
        });
        
        // Add event listeners to action buttons
        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const userId = e.target.closest('button').getAttribute('data-id');
                editUser(userId);
            });
        });
        
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const userId = e.target.closest('button').getAttribute('data-id');
                showDeleteConfirmation(userId);
            });
        });
        
    } catch (error) {
        console.error('Error loading users:', error);
        showNotification('Error loading users', 'error');
    } finally {
        showLoading(false);
    }
}

// Add new user
addUserBtn.addEventListener('click', () => {
    editingUserId = null;
    modalTitle.textContent = 'Add New User';
    userForm.reset();
    userModal.classList.add('active');
});

// Edit user
async function editUser(userId) {
    showLoading(true);
    try {
        const userDoc = await db.collection('students').doc(userId).get();
        if (userDoc.exists) {
            const userData = userDoc.data();
            editingUserId = userId;
            modalTitle.textContent = 'Edit User';
            
            document.getElementById('userName').value = userData.name;
            document.getElementById('userEmail').value = userData.email;
            document.getElementById('userPassword').value = ''; // Don't show current password
            document.getElementById('userPassword').required = false; // Make password optional for edits
            document.getElementById('userRole').value = userData.role;
            
            userModal.classList.add('active');
        }
    } catch (error) {
        console.error('Error loading user for edit:', error);
        showNotification('Error loading user data', 'error');
    } finally {
        showLoading(false);
    }
}

// Save user (create or update)
userForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('userName').value;
    const email = document.getElementById('userEmail').value;
    const password = document.getElementById('userPassword').value;
    const role = document.getElementById('userRole').value;
    
    if (!name || !email || !role) {
        showNotification('Please fill in all required fields', 'error');
        return;
    }
    
    if (!editingUserId && !password) {
        showNotification('Password is required for new users', 'error');
        return;
    }
    
    if (password && password.length < 6) {
        showNotification('Password must be at least 6 characters', 'error');
        return;
    }
    
    showLoading(true);
    
    try {
        if (editingUserId) {
            // Update existing user
            const updateData = {
                name: name,
                email: email,
                role: role,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            // Only update password if provided
            if (password) {
                // Note: In a real application, you'd need to update Firebase Auth as well
                // This requires additional Firebase Admin SDK on the backend
                showNotification('User updated (password changes require backend update)', 'warning');
            }
            
            await db.collection('students').doc(editingUserId).update(updateData);
            showNotification('User updated successfully', 'success');
        } else {
            // Create new user
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;
            
            await db.collection('students').doc(user.uid).set({
                name: name,
                email: email,
                role: role,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                enrolledCourses: {}
            });
            
            showNotification('User created successfully', 'success');
        }
        
        userModal.classList.remove('active');
        loadDashboard();
        loadUsers();
        
    } catch (error) {
        console.error('Error saving user:', error);
        let errorMessage = 'Error saving user';
        
        if (error.code === 'auth/email-already-in-use') {
            errorMessage = 'Email address is already in use';
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = 'Invalid email address';
        } else if (error.code === 'auth/weak-password') {
            errorMessage = 'Password is too weak';
        }
        
        showNotification(errorMessage, 'error');
    } finally {
        showLoading(false);
    }
});

// Show delete confirmation
async function showDeleteConfirmation(userId) {
    showLoading(true);
    try {
        const userDoc = await db.collection('students').doc(userId).get();
        if (userDoc.exists) {
            const userData = userDoc.data();
            userToDelete = { id: userId, ...userData };
            
            userToDeleteInfo.innerHTML = `
                <h4>${userData.name}</h4>
                <p><strong>Email:</strong> ${userData.email}</p>
                <p><strong>Role:</strong> ${userData.role}</p>
            `;
            
            deleteModal.classList.add('active');
        }
    } catch (error) {
        console.error('Error loading user for deletion:', error);
        showNotification('Error loading user data', 'error');
    } finally {
        showLoading(false);
    }
}

// Confirm delete
confirmDelete.addEventListener('click', async () => {
    if (!userToDelete) return;
    
    showLoading(true);
    try {
        // Delete from Firestore
        await db.collection('students').doc(userToDelete.id).delete();
        
        // Note: In a production environment, you would also delete the user from Firebase Auth
        // This requires Firebase Admin SDK on the backend
        showNotification('User deleted successfully', 'success');
        
        deleteModal.classList.remove('active');
        userToDelete = null;
        
        loadDashboard();
        loadUsers();
        
    } catch (error) {
        console.error('Error deleting user:', error);
        showNotification('Error deleting user', 'error');
    } finally {
        showLoading(false);
    }
});

// Modal close handlers
closeModal.addEventListener('click', () => {
    userModal.classList.remove('active');
});

closeDeleteModal.addEventListener('click', () => {
    deleteModal.classList.remove('active');
    userToDelete = null;
});

cancelBtn.addEventListener('click', () => {
    userModal.classList.remove('active');
});

cancelDelete.addEventListener('click', () => {
    deleteModal.classList.remove('active');
    userToDelete = null;
});

// Close modals when clicking outside
window.addEventListener('click', (e) => {
    if (e.target === userModal) {
        userModal.classList.remove('active');
    }
    if (e.target === deleteModal) {
        deleteModal.classList.remove('active');
        userToDelete = null;
    }
});

// Logout
logoutBtn.addEventListener('click', () => {
    auth.signOut().then(() => {
        window.location.href = '../index.html';
    }).catch((error) => {
        console.error('Error signing out:', error);
        showNotification('Error signing out', 'error');
    });
});

// Utility functions
function showLoading(show) {
    if (show) {
        loadingSpinner.classList.add('active');
    } else {
        loadingSpinner.classList.remove('active');
    }
}

function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notification => notification.remove());
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 5px;
        color: white;
        font-weight: 500;
        z-index: 3000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        max-width: 400px;
        animation: slideIn 0.3s ease;
    `;
    
    if (type === 'success') {
        notification.style.background = 'var(--success)';
    } else if (type === 'error') {
        notification.style.background = 'var(--danger)';
    } else if (type === 'warning') {
        notification.style.background = 'var(--warning)';
    } else {
        notification.style.background = 'var(--info)';
    }
    
    notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
            <i class="fas fa-${type === 'success' ? 'check' : type === 'error' ? 'exclamation-triangle' : type === 'warning' ? 'exclamation-circle' : 'info'}"></i>
            <span>${message}</span>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }
    }, 5000);
    
    // Add CSS animations
    if (!document.querySelector('#notification-styles')) {
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }
}

// Prevent form submission on enter key in inputs
document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
        const form = e.target.closest('form');
        if (form && form.id === 'userForm') {
            e.preventDefault();
        }
    }
});