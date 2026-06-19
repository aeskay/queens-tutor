import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

const MESSAGES = [
    "Osewime, you are the most beautiful part of my every day. Keep shining. ❤️",
    "My Queen, never forget how incredibly proud I am of you. You're doing amazing.",
    "Just a daily reminder that I love you more than words can say, Osewime.",
    "You inspire me every single day. Keep being the phenomenal woman you are. ✨",
    "Osewime, seeing your smile is the best part of my day. I love you.",
    "Your passion and dedication amaze me, my love. Have a wonderful day!",
    "You are my peace, my joy, and my everything. Have a beautiful day, Osewime.",
    "Osewime, I believe in you so much. Go out there and conquer! 💪",
    "To the woman who stole my heart: you are doing beautifully. I'm always cheering for you.",
    "I am so lucky to call you mine. Keep being awesome, Osewime. 🥰",
    "You make everything better just by being you. I love you, Osewime.",
    "Osewime, your strength and grace leave me in awe. Keep being incredible.",
    "Sending you a million kisses to start your day, my beautiful Queen. 💋",
    "I fall in love with you a little more every single day, Osewime.",
    "Whatever you face today, remember you have me in your corner always.",
    "You are my greatest blessing, Osewime. Have a fantastic day! 🌟",
    "I just wanted to remind you how deeply and truly loved you are.",
    "Osewime, you are magic. Don't let anyone dull your sparkle today. ✨",
    "My love for you grows stronger with every sunrise. Have a beautiful day.",
    "You are doing such a great job, my love. I'm so incredibly proud of you.",
    "Osewime, thank you for being the amazing woman that you are. I love you.",
    "Every day with you is a gift. Go out and be the star that you are! ⭐",
    "You are the queen of my heart, today and always. Keep glowing, Osewime.",
    "I’m sending you a big, warm hug to get you through the day. I love you!",
    "Osewime, you are beautifully and wonderfully made. Own your day! 💖",
    "Your heart is as beautiful as your face. Have the best day ever, my love.",
    "I believe in your dreams just as much as I believe in us. Keep pushing, Osewime.",
    "You light up my world in ways I can't even explain. I love you endlessly.",
    "Osewime, you're the absolute best thing that's ever happened to me.",
    "Take a deep breath and know that you are deeply loved today, my Queen.",
    "I can't wait to hear all about your day. You're going to be amazing!"
];

const SammySays: React.FC = () => {
    const { user } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [messageOfDay, setMessageOfDay] = useState("");

    useEffect(() => {
        if (!user) return;

        // Get Nigerian Time Date String (UTC+1)
        const d = new Date();
        const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
        const nigerianDate = new Date(utc + (3600000 * 1));
        const dateStr = nigerianDate.toISOString().split('T')[0];

        // Pick message based on the day to keep it consistent for the whole day
        // We can just use the day of the month
        const dayOfMonth = nigerianDate.getDate();
        const messageIndex = (dayOfMonth - 1) % MESSAGES.length;
        setMessageOfDay(MESSAGES[messageIndex]);

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

    if (!user) return null;

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
            {/* The Message Bubble */}
            <div 
                className={`mb-4 transition-all duration-500 origin-bottom-right ${isOpen ? 'scale-100 opacity-100 translate-y-0' : 'scale-0 opacity-0 translate-y-10 pointer-events-none'}`}
            >
                <div className="bg-white/90 backdrop-blur-md border border-rose-100 shadow-2xl shadow-rose-200/50 rounded-2xl p-6 w-72 sm:w-80 relative overflow-hidden">
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
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-rose-400 to-pink-500 flex items-center justify-center text-white text-sm shadow-inner">
                            S
                        </div>
                        <h4 className="font-bold text-rose-900" style={{ fontFamily: 'Outfit, sans-serif' }}>
                            Today, Sammy says...
                        </h4>
                    </div>
                    
                    <p className="text-slate-700 font-medium leading-relaxed relative z-10 text-[15px]">
                        "{messageOfDay}"
                    </p>
                </div>
            </div>

            {/* The Floating Icon */}
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className={`relative flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-tr from-rose-500 to-pink-500 text-white shadow-lg shadow-rose-500/40 hover:shadow-xl hover:shadow-rose-500/50 hover:-translate-y-1 transition-all duration-300 ${!isOpen ? 'animate-bounce' : ''}`}
                style={{ animationDuration: '2s' }}
            >
                {/* Ping animation behind the button to draw attention if not open */}
                {!isOpen && (
                    <span className="absolute inset-0 rounded-full border-2 border-rose-400 animate-ping opacity-75"></span>
                )}
                <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                </svg>
            </button>
        </div>
    );
};

export default SammySays;
