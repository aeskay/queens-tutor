import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

const MESSAGES = [
    "Osewime, you are the most beautiful part of my every day. Keep shining. ❤️",
    "My Queen, never forget how incredibly proud I am of you. You're doing amazing, Osewime.",
    "Just a daily reminder that I love you more than words can say, Osewime.",
    "Osewime, you inspire me every single day. Keep being the phenomenal woman you are. ✨",
    "Seeing your smile is the best part of my day, Osewime. I love you.",
    "Osewime, your passion and dedication amaze me, my love. Have a wonderful day!",
    "You are my peace, my joy, and my everything. Have a beautiful day, Osewime.",
    "Osewime, I believe in you so much. Go out there and conquer! 💪",
    "To the woman who stole my heart: Osewime, you are doing beautifully.",
    "I am so lucky to call you mine. Keep being awesome, Osewime. 🥰",
    "Osewime, you make everything better just by being you. I love you.",
    "Your strength and grace leave me in awe, Osewime. Keep being incredible.",
    "Sending you a million kisses to start your day, my beautiful Queen, Osewime. 💋",
    "Osewime, I fall in love with you a little more every single day.",
    "Whatever you face today, Osewime, remember you have me in your corner always.",
    "You are my greatest blessing, Osewime. Have a fantastic day! 🌟",
    "Osewime, I just wanted to remind you how deeply and truly loved you are.",
    "You are magic, Osewime. Don't let anyone dull your sparkle today. ✨",
    "My love for you grows stronger with every sunrise, Osewime.",
    "Osewime, you are doing such a great job. I'm so incredibly proud of you.",
    "Thank you for being the amazing woman that you are, Osewime. I love you.",
    "Every day with you is a gift, Osewime. Go out and be the star that you are! ⭐",
    "Osewime, you are the queen of my heart, today and always. Keep glowing.",
    "I’m sending you a big, warm hug to get you through the day, Osewime. I love you!",
    "You are beautifully and wonderfully made, Osewime. Own your day! 💖",
    "Osewime, your heart is as beautiful as your face. Have the best day ever.",
    "I believe in your dreams just as much as I believe in us. Keep pushing, Osewime.",
    "Osewime, you light up my world in ways I can't even explain. I love you endlessly.",
    "You're the absolute best thing that's ever happened to me, Osewime.",
    "Take a deep breath and know that you are deeply loved today, Osewime.",
    "Osewime, I can't wait to hear all about your day. You're going to be amazing!"
];

const SammySays: React.FC = () => {
    const { user } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [messageIndex, setMessageIndex] = useState(0);
    const [dragY, setDragY] = useState(() => {
        // Start around middle of screen
        return typeof window !== 'undefined' ? window.innerHeight / 2 : 400;
    });

    useEffect(() => {
        if (!user) return;

        // Get Nigerian Time Date String (UTC+1)
        const d = new Date();
        const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
        const nigerianDate = new Date(utc + (3600000 * 1));
        const dateStr = nigerianDate.toISOString().split('T')[0];

        // Pick initial message based on the day
        const dayOfMonth = nigerianDate.getDate();
        setMessageIndex((dayOfMonth - 1) % MESSAGES.length);

        // Check if we already opened it today
        const lastOpenedDate = localStorage.getItem('sammySaysLastOpened');
        
        if (lastOpenedDate !== dateStr) {
            // Auto open with a slight delay
            const timer = setTimeout(() => {
                setIsOpen(true);
                localStorage.setItem('sammySaysLastOpened', dateStr);
            }, 1500);
            return () => clearTimeout(timer);
        }
    }, [user]);

    const handleGetNew = () => {
        // Pick a random message different from the current one
        let nextIdx = messageIndex;
        while (nextIdx === messageIndex) {
            nextIdx = Math.floor(Math.random() * MESSAGES.length);
        }
        setMessageIndex(nextIdx);
    };

    // --- Simple Dragging Logic for the Tab ---
    // We only drag on the Y axis, locked to the right side of the screen.
    const handleTouchMove = (e: React.TouchEvent) => {
        const y = e.touches[0].clientY;
        // Keep it within screen bounds
        if (y > 50 && y < window.innerHeight - 50) {
            setDragY(y);
        }
    };

    if (!user) return null;

    return (
        <div className="fixed z-50 pointer-events-none inset-0 overflow-hidden">
            
            {/* The Tab Icon (Draggable vertically along the right edge) */}
            <div 
                className="absolute right-0 pointer-events-auto flex items-center"
                style={{ top: `${dragY}px`, transform: 'translateY(-50%)' }}
            >
                <div 
                    onTouchMove={handleTouchMove}
                    onClick={() => setIsOpen(!isOpen)}
                    className={`
                        bg-white/80 backdrop-blur-sm border border-r-0 border-rose-200 
                        rounded-l-xl p-2 shadow-sm cursor-pointer flex items-center justify-center
                        transition-all duration-300 
                        ${isOpen ? 'translate-x-full opacity-0' : 'translate-x-0 opacity-100 hover:bg-white'}
                    `}
                    style={{ touchAction: 'none' }} // Prevent scrolling while dragging
                >
                    <div className="flex flex-col items-center gap-1 opacity-40 hover:opacity-100 transition-opacity">
                        {/* Drag handle dots */}
                        <div className="flex gap-0.5">
                            <div className="w-1 h-1 rounded-full bg-rose-300" />
                            <div className="w-1 h-1 rounded-full bg-rose-300" />
                        </div>
                        <div className="flex gap-0.5">
                            <div className="w-1 h-1 rounded-full bg-rose-300" />
                            <div className="w-1 h-1 rounded-full bg-rose-300" />
                        </div>
                        <svg className="w-4 h-4 text-rose-400 mt-1" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                        </svg>
                    </div>
                </div>
            </div>

            {/* The Message Bubble (Slides in from right) */}
            <div 
                className={`
                    absolute right-4 pointer-events-auto transition-transform duration-500 ease-out
                    ${isOpen ? 'translate-x-0 opacity-100' : 'translate-x-[120%] opacity-0'}
                `}
                style={{ top: `${Math.min(Math.max(dragY - 100, 20), typeof window !== 'undefined' ? window.innerHeight - 250 : 0)}px` }}
            >
                <div className="bg-white/95 backdrop-blur-md border border-rose-100 shadow-2xl shadow-rose-200/50 rounded-2xl p-6 w-[280px] sm:w-[320px] relative overflow-hidden flex flex-col">
                    {/* Decorative elements */}
                    <div className="absolute -top-10 -right-10 w-24 h-24 bg-rose-100 rounded-full blur-2xl opacity-60 pointer-events-none"></div>
                    <div className="absolute -bottom-10 -left-10 w-24 h-24 bg-pink-100 rounded-full blur-2xl opacity-60 pointer-events-none"></div>
                    
                    <button 
                        onClick={() => setIsOpen(false)}
                        className="absolute top-3 right-3 text-rose-300 hover:text-rose-500 transition-colors bg-rose-50/50 hover:bg-rose-100 rounded-full p-1"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                    
                    <div className="flex items-center gap-2 mb-3 relative z-10">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-rose-400 to-pink-500 flex items-center justify-center text-white text-sm shadow-inner shrink-0">
                            S
                        </div>
                        <h4 className="font-bold text-rose-900" style={{ fontFamily: 'Outfit, sans-serif' }}>
                            Today, Sammy says...
                        </h4>
                    </div>
                    
                    <p className="text-slate-700 font-medium leading-relaxed relative z-10 text-[15px] italic mb-6">
                        "{MESSAGES[messageIndex]}"
                    </p>

                    <button 
                        onClick={handleGetNew}
                        className="self-center mt-auto flex items-center gap-2 px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold rounded-xl transition-colors relative z-10 border border-rose-100"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                        Get Another
                    </button>
                </div>
            </div>

        </div>
    );
};

export default SammySays;
