export interface StudentData {
    id: string;
    userId: string;
    name: string;
    notes?: string;
    archived?: boolean;
    createdAt?: any;
    updatedAt?: any;
}

export interface UploadedContent {
    id: string;
    title: string;
    summary: string;
    createdAt: string;
    text: string;
}

export interface ClassData {
    id: string;
    userId: string;
    name: string;
    teacherName: string;
    studentId?: string; // New: reference to StudentData.id
    studentName?: string; // Legacy/Fallback
    status?: 'in-progress' | 'completed'; // New: manual toggle overrides progress
    studentCount: number;
    completedLessons: number;
    totalLessons: number;
    classDate?: string; // ISO date string YYYY-MM-DD
    lessons?: any[];
    uploadedContents?: UploadedContent[];
    createdAt?: any;
    lastGenerated?: any;
    syllabusText?: string;
}

export interface TopicSuggestion {
    id: string;
    userId: string;
    topicTitle: string;
    summary: string;
    ageGroup: string;
    createdAt: any;
}

export interface TriviaQuestion {
    question: string;
    options: string[];
    correctAnswer: string;
    funFact: string;
}

export interface TriviaGame {
    id: string;
    userId: string;
    topic: string;
    ageGroup: string;
    questions: TriviaQuestion[];
    createdAt: any;
}

export interface StoryGame {
    id: string;
    userId: string;
    topic: string;
    studentName: string;
    ageGroup: string;
    setting?: string;
    title: string;
    paragraphs: string[];
    moralOrFact: string;
    createdAt: any;
}

export interface DailySpark {
    id: string;
    userId: string;
    category: string;
    ageGroup: string;
    country?: string;
    title: string;
    theHook: string;
    theCoreContent: string;
    interactiveElement: string;
    funFact: string;
    createdAt: any;
}
