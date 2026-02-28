export interface Word {
    id: string;
    userId?: string;
    wordSetId?: string;
    text: string;
    locationLabel?: string | null;
    imageKey?: string | null;
    isMastered?: boolean;
    lastReviewedAt?: string | number | Date | null;
    createdAt: string | number | Date;
    updatedAt: string | number | Date;
    meanings?: {
        meaning: string;
        partOfSpeech?: string | null;
    }[];
    meaning?: string | null;
}

export interface WordSet {
    id: string;
    userId?: string;
    name: string;
    createdAt?: string | number | Date;
    updatedAt?: string | number | Date;
}