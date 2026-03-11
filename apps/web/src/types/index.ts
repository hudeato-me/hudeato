import { authClient } from '~/lib/auth-client'

export type Session = typeof authClient.$Infer.Session

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

export interface FieldSetting {
    key: string;
    label: string;
    type: 'text' | 'textarea';
    visible: boolean;
    order: number;
}

export interface WordSet {
    id: string;
    userId?: string;
    name: string;
    settings?: string | null;
    createdAt?: string | number | Date;
    updatedAt?: string | number | Date;
    wordCount?: number;
}