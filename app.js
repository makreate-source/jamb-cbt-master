// app.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { getFirestore, enableIndexedDbPersistence, doc, setDoc, getDoc, onSnapshot, updateDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { database } from "./questions.js";

// --- 1. FIREBASE CONFIGURATION ---
const firebaseConfig = {
  apiKey: "AIzaSyB857tx7Z-jqNOQC4w_o1T-cTQdFd11yxg",
  authDomain: "jamb-cbt-master.firebaseapp.com",
  projectId: "jamb-cbt-master",
  storageBucket: "jamb-cbt-master.firebasestorage.app",
  messagingSenderId: "1096384090423",
  appId: "1:1096384090423:web:2c98c37c27fe5590688ab2"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Enable Offline Persistence for the Database
enableIndexedDbPersistence(db).catch((err) => {
    console.log("Offline mode failed to initialize:", err.code);
});

// --- STATE MANAGEMENT ---
let currentUser = null;
let isPremium = false;
let currentSubject = 'mathematics';
let currentIndex = 0;
let userAnswers = {};
let activeQuestions = [];
let sessionUnsubscribe = null;

// --- 2. AUTHENTICATION LOGIC ---
const emailInput = document.getElementById('email-input');
const passwordInput = document.getElementById('password-input');

document.getElementById('login-btn').addEventListener('click', async () => {
    const email = emailInput.value;
    const pass = passwordInput.value;
    try {
        await signInWithEmailAndPassword(auth, email, pass);
    } catch (error) {
        if(error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
            try {
                await createUserWithEmailAndPassword(auth, email, pass);
            } catch (err) { alert(err.message); }
        } else { alert(error.message); }
    }
});

document.getElementById('google-btn').addEventListener('click', () => {
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider).catch(err => alert(err.message));
});

document.getElementById('logout-btn').addEventListener('click', () => {
    signOut(auth);
});

// --- 3. SESSION MANAGEMENT & DATABASE SYNC ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('exam-screen').classList.remove('hidden');
        document.getElementById('user-email-display').innerText = user.email;
        
        const sessionToken = Math.random().toString(36).substring(2);
        localStorage.setItem('localSessionToken', sessionToken);

        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
            await setDoc(userRef, {
                email: user.email,
                isPremium: false,
                expiryDate: null,
                sessionToken: sessionToken
            });
            isPremium = false;
        } else {
            await updateDoc(userRef, { sessionToken: sessionToken });
        }

        sessionUnsubscribe = onSnapshot(userRef, (docSnap) => {
            const data = docSnap.data();
            if (data.sessionToken !== localStorage.getItem('localSessionToken')) {
                alert("You have been logged out because your account was accessed from another device.");
                signOut(auth);
                return;
            }
            
            if (data.isPremium && data.expiryDate) {
                if (new Date().getTime() > data.expiryDate) {
                    updateDoc(userRef, { isPremium: false, expiryDate: null });
                    isPremium = false;
                } else {
                    isPremium = true;
                }
            } else {
                isPremium = false;
            }
            loadSubject(currentSubject);
        });

    } else {
        currentUser = null;
        if(sessionUnsubscribe) sessionUnsubscribe();
        document.getElementById('auth-screen').classList.remove('hidden');
        document.getElementById('exam-screen').classList.add('hidden');
    }
});

// --- 4. EXAM ENGINE & 8-KEY CONTROLS ---
function loadSubject(subject) {
    let allQ = database[subject] || [];
    activeQuestions = isPremium ? allQ : allQ.slice(0, 20);
    currentIndex = 0;
    renderQuestion();
}

function renderQuestion() {
    if (!isPremium && currentIndex >= 20) {
        document.getElementById('upgrade-modal').classList.remove('hidden');
        currentIndex = 19;
        return;
    }

    const q = activeQuestions[currentIndex];
    if (!q) return;

    document.getElementById('question-number').innerText = `Question ${currentIndex + 1} of ${activeQuestions.length}`;
    document.getElementById('question-text').innerText = q.text;

    const optContainer = document.getElementById('options-container');
    optContainer.innerHTML = '';
    const letters = ['A', 'B', 'C', 'D'];
    
    q.options.forEach((opt, idx) => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        if (userAnswers[currentIndex] === letters[idx]) btn.classList.add('selected');
        btn.innerText = `${letters[idx]}. ${opt}`;
        btn.onclick = () => { userAnswers[currentIndex] = letters[idx]; renderQuestion(); };
        optContainer.appendChild(btn);
    });
}

const prevQ = () => { if (currentIndex > 0) { currentIndex--; renderQuestion(); } };
const nextQ = () => { 
    if (currentIndex < activeQuestions.length - 1) { currentIndex++; renderQuestion(); }
    else if (!isPremium && currentIndex === 19) document.getElementById('upgrade-modal').classList.remove('hidden');
};
const clearQ = () => { delete userAnswers[currentIndex]; renderQuestion(); };
const submitExam = () => { if(confirm("Submit Exam?")) alert("Exam Submitted!"); };

document.getElementById('btn-prev').onclick = prevQ;
document.getElementById('btn-next').onclick = nextQ;
document.getElementById('btn-reverse').onclick = clearQ;
document.getElementById('submit-btn').onclick = submitExam;

document.addEventListener('keydown', (e) => {
    if (document.getElementById('exam-screen').classList.contains('hidden')) return;
    const key = e.key.toUpperCase();
    if(key === 'A') { userAnswers[currentIndex] = 'A'; renderQuestion(); }
    if(key === 'B') { userAnswers[currentIndex] = 'B'; renderQuestion(); }
    if(key === 'C') { userAnswers[currentIndex] = 'C'; renderQuestion(); }
    if(key === 'D') { userAnswers[currentIndex] = 'D'; renderQuestion(); }
    if(key === 'P') prevQ();
    if(key === 'N') nextQ();
    if(key === 'R') clearQ();
    if(key === 'S') submitExam();
});

document.getElementById('close-upgrade').onclick = () => document.getElementById('upgrade-modal').classList.add('hidden');
document.getElementById('whatsapp-btn').onclick = () => {
    const msg = `Hello Admin, I just paid ₦1,000 via OPay. My account email is ${currentUser.email}.`;
    window.open(`https://wa.me/2348000000000?text=${encodeURIComponent(msg)}`, '_blank');
};

// --- 5. SECRET ADMIN PANEL ---
let tapCount = 0;
let tapTimeout;
document.getElementById('secret-header-trigger').addEventListener('click', () => {
    tapCount++;
    clearTimeout(tapTimeout);
    tapTimeout = setTimeout(() => tapCount = 0, 2000);

    if (tapCount >= 5) {
        const pass = prompt("Admin Password:");
        if (pass === "YOUR_SECRET_PASSWORD") {
            document.getElementById('admin-modal').classList.remove('hidden');
        } else { alert("Unauthorized"); }
        tapCount = 0;
    }
});

document.getElementById('close-admin').onclick = () => document.getElementById('admin-modal').classList.add('hidden');

document.getElementById('admin-upgrade-btn').onclick = async () => {
    const studentEmail = document.getElementById('admin-user-email').value.trim();
    if (!studentEmail) return;

    const usersRef = collection(db, "users");
    const q = query(usersRef, where("email", "==", studentEmail));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
        alert("User email not found in database.");
        return;
    }

    querySnapshot.forEach(async (userDoc) => {
        const expiryDate = new Date();
        expiryDate.setMonth(expiryDate.getMonth() + 1);

        await updateDoc(userDoc.ref, {
            isPremium: true,
            expiryDate: expiryDate.getTime()
        });
        alert(`Successfully upgraded ${studentEmail} for 30 Days!`);
        document.getElementById('admin-modal').classList.add('hidden');
    });
};
