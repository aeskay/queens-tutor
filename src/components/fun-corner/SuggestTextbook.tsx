import React, { useState } from 'react';

// ─── Country list (name + flag emoji) ────────────────────────────────────────
const COUNTRIES = [
    { name: 'Nigeria', flag: '🇳🇬' },
    { name: 'United States', flag: '🇺🇸' },
    { name: 'United Kingdom', flag: '🇬🇧' },
    { name: 'Ghana', flag: '🇬🇭' },
    { name: 'Kenya', flag: '🇰🇪' },
    { name: 'South Africa', flag: '🇿🇦' },
    { name: 'India', flag: '🇮🇳' },
    { name: 'Australia', flag: '🇦🇺' },
    { name: 'Canada', flag: '🇨🇦' },
    { name: 'Ireland', flag: '🇮🇪' },
    { name: 'New Zealand', flag: '🇳🇿' },
    { name: 'Pakistan', flag: '🇵🇰' },
    { name: 'Bangladesh', flag: '🇧🇩' },
    { name: 'Tanzania', flag: '🇹🇿' },
    { name: 'Uganda', flag: '🇺🇬' },
    { name: 'Zimbabwe', flag: '🇿🇼' },
    { name: 'Zambia', flag: '🇿🇲' },
    { name: 'Ethiopia', flag: '🇪🇹' },
    { name: 'Cameroon', flag: '🇨🇲' },
    { name: 'Sierra Leone', flag: '🇸🇱' },
    { name: 'Liberia', flag: '🇱🇷' },
    { name: 'Botswana', flag: '🇧🇼' },
    { name: 'Jamaica', flag: '🇯🇲' },
    { name: 'Trinidad and Tobago', flag: '🇹🇹' },
    { name: 'Barbados', flag: '🇧🇧' },
    { name: 'Singapore', flag: '🇸🇬' },
    { name: 'Malaysia', flag: '🇲🇾' },
    { name: 'Philippines', flag: '🇵🇭' },
];

// ─── Grade lingo helper (mirrors server-side) ─────────────────────────────────
function getGradeLingo(country: string): string {
    const c = country.toLowerCase();
    if (['united kingdom', 'uk', 'england', 'wales', 'scotland', 'nigeria', 'ghana', 'kenya', 'australia', 'new zealand', 'south africa', 'ireland', 'sierra leone', 'liberia', 'botswana', 'zambia', 'zimbabwe', 'tanzania', 'uganda', 'cameroon'].some(x => c.includes(x))) {
        return 'Year';
    }
    if (['india', 'pakistan', 'bangladesh'].some(x => c.includes(x))) {
        return 'Class';
    }
    return 'Grade';
}

interface Textbook {
    title: string;
    authors: string;
    edition: string;
    description: string;
    curriculumNote: string;
    pdfSearchQuery: string;
    openLibraryUrl: string;
}

const SUBJECTS = [
    'Mathematics', 'English Language', 'Physics', 'Chemistry', 'Biology',
    'Further Mathematics', 'Economics', 'Literature in English', 'Geography',
    'Government / Civics', 'History', 'Computer Science / ICT', 'French',
    'Agricultural Science', 'Technical Drawing', 'Physical Education',
    'Religious Studies', 'Social Studies', 'Business Studies', 'Accounting',
    'Music', 'Art & Design', 'Home Economics', 'Other'
];

const SuggestTextbook: React.FC = () => {
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [country, setCountry] = useState('');
    const [countrySearch, setCountrySearch] = useState('');
    const [showCountryDropdown, setShowCountryDropdown] = useState(false);
    const [grade, setGrade] = useState('');
    const [subject, setSubject] = useState('English Language');
    const [extraInfo, setExtraInfo] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [textbooks, setTextbooks] = useState<Textbook[]>([]);
    const [gradeLingo, setGradeLingo] = useState('Grade');
    const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

    const filteredCountries = COUNTRIES.filter(c =>
        c.name.toLowerCase().includes(countrySearch.toLowerCase())
    );

    const selectedCountryObj = COUNTRIES.find(c => c.name === country);
    const dynamicGradeLingo = country ? getGradeLingo(country) : 'Grade';

    const handleSelectCountry = (name: string) => {
        setCountry(name);
        setCountrySearch(name);
        setShowCountryDropdown(false);
    };

    const handleSearch = async () => {
        if (!country || !grade.trim() || !subject) return;
        setIsLoading(true);
        setError(null);
        setTextbooks([]);

        try {
            const response = await fetch('/.netlify/functions/suggest-textbook', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ country, grade: grade.trim(), subject, extraInfo })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Failed to find textbooks. Please try again.');
            }

            const data = await response.json();
            setTextbooks(data.textbooks || []);
            setGradeLingo(data.gradeLingo || dynamicGradeLingo);
            setStep(3);
        } catch (err: any) {
            setError(err.message || 'An error occurred.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCopySearch = (query: string, idx: number) => {
        navigator.clipboard.writeText(query).then(() => {
            setCopiedIdx(idx);
            setTimeout(() => setCopiedIdx(null), 2000);
        });
    };

    const handleGoogleSearch = (query: string) => {
        window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, '_blank');
    };

    const handleArchiveSearch = (title: string, authors: string) => {
        const q = `${title} ${authors}`.trim();
        window.open(`https://archive.org/search?query=${encodeURIComponent(q)}&mediatype=texts`, '_blank');
    };

    const handleReset = () => {
        setStep(1);
        setTextbooks([]);
        setError(null);
    };

    return (
        <div className="flex flex-col gap-6">
            {/* ── Header ── */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h2 className="text-xl font-black text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }}>
                        📚 Find Free Textbooks
                    </h2>
                    <p className="text-sm text-slate-500 mt-0.5">
                        Tell us where your student is, and we'll find curriculum-matched free PDFs.
                    </p>
                </div>
                {step === 3 && (
                    <button
                        onClick={handleReset}
                        className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
                    >
                        ← New Search
                    </button>
                )}
            </div>

            {/* ── Step Indicator ── */}
            <div className="flex items-center gap-2">
                {[1, 2, 3].map(s => (
                    <React.Fragment key={s}>
                        <div className={`flex items-center gap-2 transition-all`}>
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black transition-all ${step >= s ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30' : 'bg-slate-100 text-slate-400'}`}>
                                {step > s ? '✓' : s}
                            </div>
                            <span className={`text-xs font-bold hidden sm:block ${step >= s ? 'text-slate-700' : 'text-slate-400'}`}>
                                {s === 1 ? 'Country' : s === 2 ? 'Details' : 'Results'}
                            </span>
                        </div>
                        {s < 3 && <div className={`flex-1 h-0.5 rounded-full transition-all ${step > s ? 'bg-emerald-400' : 'bg-slate-100'}`} />}
                    </React.Fragment>
                ))}
            </div>

            {/* ── Step 1: Country ── */}
            {step === 1 && (
                <div className="max-w-md">
                    <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 rounded-2xl p-6 space-y-5">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white text-xl">🌍</div>
                            <div>
                                <h3 className="font-black text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }}>Where is your student?</h3>
                                <p className="text-xs text-slate-500">We use this to match the right curriculum</p>
                            </div>
                        </div>

                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Search country..."
                                value={countrySearch}
                                onChange={e => { setCountrySearch(e.target.value); setShowCountryDropdown(true); setCountry(''); }}
                                onFocus={() => setShowCountryDropdown(true)}
                                className="w-full px-4 py-3 bg-white border border-emerald-200 rounded-xl focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400 focus:outline-none transition-all text-sm font-medium placeholder:text-slate-400"
                            />
                            {showCountryDropdown && filteredCountries.length > 0 && (
                                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-20 max-h-60 overflow-y-auto">
                                    {filteredCountries.map(c => (
                                        <button
                                            key={c.name}
                                            onClick={() => handleSelectCountry(c.name)}
                                            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-emerald-50 transition-colors text-left"
                                        >
                                            <span className="text-xl">{c.flag}</span>
                                            <span className="text-sm font-semibold text-slate-700">{c.name}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Quick pick popular */}
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Popular</p>
                            <div className="flex flex-wrap gap-2">
                                {['Nigeria', 'Ghana', 'Kenya', 'United States', 'United Kingdom', 'India'].map(c => {
                                    const obj = COUNTRIES.find(x => x.name === c);
                                    return (
                                        <button
                                            key={c}
                                            onClick={() => { handleSelectCountry(c); }}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${country === c ? 'bg-emerald-500 text-white border-emerald-500 shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300 hover:bg-emerald-50'}`}
                                        >
                                            <span>{obj?.flag}</span> {c}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <button
                            onClick={() => { if (country) setStep(2); }}
                            disabled={!country}
                            className="w-full py-3 rounded-xl bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-500/25 hover:bg-emerald-600 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            Continue →
                        </button>
                    </div>
                </div>
            )}

            {/* ── Step 2: Grade / Subject / Extra ── */}
            {step === 2 && (
                <div className="max-w-md">
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-6 space-y-5">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center text-white text-xl">
                                {selectedCountryObj?.flag || '📘'}
                            </div>
                            <div>
                                <h3 className="font-black text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }}>
                                    {country} — What are they studying?
                                </h3>
                                <p className="text-xs text-slate-500">Tell us the level and subject</p>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-blue-700/70 uppercase tracking-widest mb-1.5">
                                {dynamicGradeLingo} / Level *
                            </label>
                            <input
                                type="text"
                                placeholder={dynamicGradeLingo === 'Year' ? 'e.g. Year 10, JSS 2, SS 3' : dynamicGradeLingo === 'Class' ? 'e.g. Class 8, 10th Class' : 'e.g. Grade 9, 11th Grade'}
                                value={grade}
                                onChange={e => setGrade(e.target.value)}
                                className="w-full px-4 py-3 bg-white border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-300 focus:border-blue-400 focus:outline-none transition-all text-sm font-medium"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-blue-700/70 uppercase tracking-widest mb-1.5">Subject *</label>
                            <div className="relative">
                                <select
                                    value={subject}
                                    onChange={e => setSubject(e.target.value)}
                                    className="w-full px-4 py-3 bg-white border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-300 focus:border-blue-400 focus:outline-none transition-all text-sm font-semibold text-slate-700 appearance-none cursor-pointer"
                                >
                                    {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-blue-500">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" /></svg>
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-blue-700/70 uppercase tracking-widest mb-1.5">
                                Extra Info <span className="font-normal normal-case text-slate-400">(optional)</span>
                            </label>
                            <textarea
                                rows={2}
                                placeholder="e.g. WAEC exam prep, focusing on algebra, beginner level..."
                                value={extraInfo}
                                onChange={e => setExtraInfo(e.target.value)}
                                className="w-full px-4 py-3 bg-white border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-300 focus:border-blue-400 focus:outline-none transition-all text-sm font-medium resize-none"
                            />
                        </div>

                        {error && (
                            <div className="bg-red-50 text-red-600 text-sm p-3 rounded-xl border border-red-100">
                                {error}
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button
                                onClick={() => setStep(1)}
                                className="flex-1 py-3 rounded-xl bg-white border border-blue-200 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition-all"
                            >
                                ← Back
                            </button>
                            <button
                                onClick={handleSearch}
                                disabled={!grade.trim() || !subject || isLoading}
                                className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-bold text-sm shadow-lg shadow-blue-600/25 hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isLoading ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Finding books...
                                    </>
                                ) : (
                                    '🔍 Find Textbooks'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Step 3: Results ── */}
            {step === 3 && (
                <div>
                    {/* Summary banner */}
                    <div className="flex flex-wrap items-center gap-2 mb-5">
                        <div className="inline-flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold px-3 py-1.5 rounded-full">
                            🌍 {selectedCountryObj?.flag} {country}
                        </div>
                        <div className="inline-flex items-center gap-1.5 bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold px-3 py-1.5 rounded-full">
                            📚 {gradeLingo} {grade}
                        </div>
                        <div className="inline-flex items-center gap-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold px-3 py-1.5 rounded-full">
                            🎓 {subject}
                        </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        {textbooks.map((book, idx) => (
                            <div
                                key={idx}
                                className="bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow-lg hover:shadow-slate-200/60 hover:-translate-y-0.5 transition-all flex flex-col overflow-hidden"
                            >
                                {/* Colour stripe */}
                                <div className={`h-1.5 w-full ${['bg-blue-500','bg-emerald-500','bg-violet-500','bg-amber-500','bg-rose-500'][idx % 5]}`} />

                                <div className="p-5 flex flex-col flex-1">
                                    {/* Book number badge */}
                                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm font-black text-white mb-3 ${['bg-blue-500','bg-emerald-500','bg-violet-500','bg-amber-500','bg-rose-500'][idx % 5]}`}>
                                        {idx + 1}
                                    </div>

                                    <h3 className="font-black text-slate-900 leading-tight mb-1" style={{ fontFamily: 'Outfit, sans-serif' }}>
                                        {book.title}
                                    </h3>
                                    <p className="text-xs text-slate-400 font-semibold mb-1">{book.authors}</p>
                                    {book.edition && book.edition !== 'N/A' && (
                                        <span className="inline-block text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md mb-3">
                                            {book.edition}
                                        </span>
                                    )}

                                    <p className="text-sm text-slate-600 leading-relaxed mb-3 flex-1">
                                        {book.description}
                                    </p>

                                    {/* Curriculum note */}
                                    {book.curriculumNote && (
                                        <div className="bg-emerald-50 border-l-4 border-emerald-400 px-3 py-2 rounded-r-xl mb-4">
                                            <p className="text-xs font-bold text-emerald-700">{book.curriculumNote}</p>
                                        </div>
                                    )}

                                    {/* Action buttons */}
                                    <div className="flex flex-col gap-2 mt-auto">
                                        <button
                                            onClick={() => {
                                                // Strip any site: operator the AI may have added — Archive.org has its own button
                                                const baseQuery = (book.pdfSearchQuery || `${book.title} ${book.authors}`)
                                                    .replace(/\bsite:\S+/gi, '')
                                                    .replace(/\bfiletype:\S+/gi, '')
                                                    .trim();
                                                handleGoogleSearch(`${baseQuery} filetype:pdf`);
                                            }}
                                            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-slate-700 transition-all active:scale-95"
                                        >
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                            Search Free PDF
                                        </button>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleArchiveSearch(book.title, book.authors)}
                                                className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-amber-50 text-amber-700 text-xs font-bold rounded-xl hover:bg-amber-100 transition-all border border-amber-200"
                                            >
                                                🗃️ Archive.org
                                            </button>
                                            <button
                                                onClick={() => handleCopySearch(book.pdfSearchQuery || `${book.title} ${book.authors}`, idx)}
                                                className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-50 text-slate-600 text-xs font-bold rounded-xl hover:bg-slate-100 transition-all border border-slate-200"
                                            >
                                                {copiedIdx === idx ? '✓ Copied!' : '📋 Copy Query'}
                                            </button>
                                        </div>
                                        {book.openLibraryUrl && (
                                            <a
                                                href={book.openLibraryUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-blue-50 text-blue-700 text-xs font-bold rounded-xl hover:bg-blue-100 transition-all border border-blue-200"
                                            >
                                                📖 Open Library / Direct Link
                                            </a>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Disclaimer */}
                    <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-4">
                        <p className="text-xs text-amber-800 font-medium">
                            <strong>⚠️ Heads up:</strong> These are AI-suggested textbooks based on common curriculum knowledge.
                            The "Search Free PDF" button opens a targeted Google search — always verify you're downloading from a legitimate source like archive.org, government education portals, or official publisher pages.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SuggestTextbook;
