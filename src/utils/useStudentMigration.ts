import { useEffect } from 'react';
import { collection, query, where, getDocs, writeBatch, doc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';

export const useStudentMigration = () => {
    const { user } = useAuth();

    useEffect(() => {
        if (!user) return;

        const runMigration = async () => {
            try {
                // Find classes belonging to the user that do not have a studentId
                const classesQuery = query(collection(db, 'classes'), where('userId', '==', user.uid));
                const classesSnapshot = await getDocs(classesQuery);

                const classesToUpdate = classesSnapshot.docs.filter(d => !d.data().studentId && d.data().studentName);
                
                if (classesToUpdate.length === 0) return; // Nothing to migrate

                const batch = writeBatch(db);

                // Group by studentName
                const studentsMap = new Map<string, string>(); // name -> studentId

                for (const classDoc of classesToUpdate) {
                    const data = classDoc.data();
                    const sName = data.studentName.trim() || 'Unnamed Student';

                    let studentId = studentsMap.get(sName);
                    
                    if (!studentId) {
                        // Create a new Student document
                        const studentRef = doc(collection(db, 'students'));
                        studentId = studentRef.id;
                        studentsMap.set(sName, studentId);

                        batch.set(studentRef, {
                            userId: user.uid,
                            name: sName,
                            createdAt: new Date()
                        });
                    }

                    // Update class
                    batch.update(classDoc.ref, { studentId });
                }

                await batch.commit();
                console.log('Successfully migrated classes to use student records.');
            } catch (err) {
                console.error('Migration failed:', err);
            }
        };

        runMigration();
    }, [user]);
};
