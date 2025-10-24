// ===========================
// Centralized Authentication Manager
// Use this in ALL modules for user validation
// ===========================

class AuthManager {
    constructor() {
        this.currentUser = null;
        this.isValidUser = false;
        this.studentData = null;
        this.authCallbacks = [];
        this.init();
    }

    async init() {
        try {
            // Initialize Firebase if not already initialized
            if (!firebase.apps.length) {
                const firebaseConfig = {
                    apiKey: "AIzaSyD44h0Uak9EeQs2A_aAfSvyRKT4jgdSuHg",
                    authDomain: "jtimwiki.firebaseapp.com",
                    projectId: "jtimwiki",
                    storageBucket: "jtimwiki.firebasestorage.app",
                    messagingSenderId: "125581944053",
                    appId: "1:125581944053:web:e314fcdd288daf97c1d1bc",
                    measurementId: "G-WNVG1L3CZK"
                };
                
                firebase.initializeApp(firebaseConfig);
            }
            
            this.auth = firebase.auth();
            this.db = firebase.firestore();
            
            this.setupAuthListener();
            console.log("Auth Manager initialized");
        } catch (error) {
            console.error("Auth Manager init error:", error);
        }
    }

    setupAuthListener() {
        this.auth.onAuthStateChanged(async (user) => {
            if (user) {
                console.log("User authenticated:", user.uid);
                try {
                    const doc = await this.db.collection('students').doc(user.uid).get();
                    if (doc.exists) {
                        this.currentUser = user;
                        this.isValidUser = true;
                        this.studentData = doc.data();
                        console.log("User validated in database");
                        this.notifyAuthStateChange({ 
                            user, 
                            isValid: true, 
                            studentData: doc.data() 
                        });
                    } else {
                        console.log("User not found in database - creating student record");
                        // Auto-create student record
                        await this.createStudentRecord(user);
                        this.currentUser = user;
                        this.isValidUser = true;
                        this.studentData = { 
                            name: user.displayName || 'Student', 
                            email: user.email 
                        };
                        this.notifyAuthStateChange({ 
                            user, 
                            isValid: true, 
                            studentData: this.studentData 
                        });
                    }
                } catch (error) {
                    console.error('Database validation error:', error);
                    this.notifyAuthStateChange({ user: null, isValid: false });
                }
            } else {
                console.log("No user authenticated");
                this.currentUser = null;
                this.isValidUser = false;
                this.studentData = null;
                this.notifyAuthStateChange({ user: null, isValid: false });
            }
        });
    }

    async createStudentRecord(user) {
        try {
            await this.db.collection('students').doc(user.uid).set({
                name: user.displayName || 'Student',
                email: user.email,
                registrationDate: new Date().toISOString(),
                course: "Digital Skills Certificate",
                status: "active",
                progress: {}
            });
            console.log("Student record created for:", user.uid);
        } catch (error) {
            console.error("Error creating student record:", error);
            throw error;
        }
    }

    onAuthStateChange(callback) {
        this.authCallbacks.push(callback);
        callback({ 
            user: this.currentUser, 
            isValid: this.isValidUser, 
            studentData: this.studentData 
        });
    }

    notifyAuthStateChange(state) {
        this.authCallbacks.forEach(callback => {
            try {
                callback(state);
            } catch (error) {
                console.error('Auth callback error:', error);
            }
        });
    }

    async validateAccess() {
        if (!this.currentUser || !this.isValidUser) {
            console.log("Access denied: No valid user");
            return false;
        }
        
        try {
            const doc = await this.db.collection('students').doc(this.currentUser.uid).get();
            const isValid = doc.exists;
            
            if (!isValid) {
                this.auth.signOut();
            }
            
            return isValid;
        } catch (error) {
            console.error('Access validation failed:', error);
            return false;
        }
    }

    async checkModuleAccess(moduleNumber) {
        const hasAccess = await this.validateAccess();
        if (!hasAccess) return false;
        
        const progress = this.studentData?.progress || {};
        
        if (moduleNumber === 1) return true;
        
        const previousModule = moduleNumber - 1;
        return progress[`module${previousModule}`] === 'completed';
    }

    getCurrentUser() {
        return {
            user: this.currentUser,
            studentData: this.studentData,
            isValid: this.isValidUser
        };
    }

    async login(email, password) {
        try {
            const userCredential = await this.auth.signInWithEmailAndPassword(email, password);
            
            const doc = await this.db.collection('students').doc(userCredential.user.uid).get();
            if (!doc.exists) {
                console.log("No student record found - creating one automatically");
                await this.createStudentRecord(userCredential.user);
            }
            
            return {
                user: userCredential.user,
                studentData: doc.exists ? doc.data() : { 
                    name: userCredential.user.displayName || 'Student', 
                    email: userCredential.user.email 
                }
            };
        } catch (error) {
            throw error;
        }
    }

    async logout() {
        return await this.auth.signOut();
    }
}

// Create global instance
window.authManager = new AuthManager();