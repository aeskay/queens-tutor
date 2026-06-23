import { useState, useEffect } from 'react';
import { collection, addDoc, query, where, onSnapshot, deleteDoc, doc, serverTimestamp, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';

export interface SavedBook {
    id: string;
    userId: string;
    listName: string;
    title: string;
    authors: string;
    edition?: string;
    description: string;
    curriculumNote?: string;
    pdfSearchQuery?: string;
    openLibraryUrl?: string;
    savedAt: Date | null;
}

export function useSavedBooks() {
    const { user } = useAuth();
    const [savedBooks, setSavedBooks] = useState<SavedBook[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) {
            setSavedBooks([]);
            setLoading(false);
            return;
        }

        const q = query(
            collection(db, 'savedBooks'),
            where('userId', '==', user.uid),
            orderBy('savedAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const books: SavedBook[] = [];
            snapshot.forEach((doc) => {
                const data = doc.data();
                books.push({
                    id: doc.id,
                    ...data,
                    savedAt: data.savedAt ? data.savedAt.toDate() : new Date(),
                } as SavedBook);
            });
            setSavedBooks(books);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching saved books:", error);
            // If index is missing, firestore will throw an error. 
            // Fallback to client-side sorting if order by fails before index is built
            if (error.message.includes('index')) {
                const fallbackQ = query(collection(db, 'savedBooks'), where('userId', '==', user.uid));
                onSnapshot(fallbackQ, (fallbackSnap) => {
                    const books: SavedBook[] = [];
                    fallbackSnap.forEach((d) => {
                        const data = d.data();
                        books.push({
                            id: d.id,
                            ...data,
                            savedAt: data.savedAt ? data.savedAt.toDate() : new Date(),
                        } as SavedBook);
                    });
                    // Client-side sort
                    books.sort((a, b) => (b.savedAt?.getTime() || 0) - (a.savedAt?.getTime() || 0));
                    setSavedBooks(books);
                    setLoading(false);
                });
            } else {
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, [user]);

    const saveBook = async (bookData: Omit<SavedBook, 'id' | 'userId' | 'savedAt'>) => {
        if (!user) throw new Error("Must be logged in to save a book");
        
        await addDoc(collection(db, 'savedBooks'), {
            ...bookData,
            userId: user.uid,
            savedAt: serverTimestamp(),
        });
    };

    const removeBook = async (bookId: string) => {
        if (!user) return;
        await deleteDoc(doc(db, 'savedBooks', bookId));
    };

    // Helper to get unique list names
    const getLists = () => {
        const lists = new Set<string>();
        savedBooks.forEach(b => lists.add(b.listName));
        return Array.from(lists).sort();
    };

    return {
        savedBooks,
        loading,
        saveBook,
        removeBook,
        getLists
    };
}
