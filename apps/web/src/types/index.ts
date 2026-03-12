import { authClient } from '~/lib/auth-client'
import { InferResponseType, InferRequestType } from "hono/client"
import { client } from "~/lib/api-client"

export type Session = typeof authClient.$Infer.Session

export type WordSet = InferResponseType<typeof client.api.v1.sets.$get, 200>[number]

export type Word = InferResponseType<typeof client.api.v1.sets[":setId"]["words"]["$get"], 200>[number]

// 単語詳細の型 (GET /api/v1/sets/:setId/words/:wordId)
export type WordWithDetails = InferResponseType<typeof client.api.v1.sets[":setId"]["words"][":wordId"]["$get"], 200>["data"]

export type CreateWordReq = InferRequestType<typeof client.api.v1.sets[":setId"]["words"]["$post"]>["json"]
export type UpdateWordReq = InferRequestType<typeof client.api.v1.sets[":setId"]["words"][":wordId"]["$put"]>["json"]
export type CreateWordSetReq = InferRequestType<typeof client.api.v1.sets["$post"]>["json"]
export type UpdateWordSetReq = InferRequestType<typeof client.api.v1.sets[":setId"]["$put"]>["json"]

export interface FieldSetting {
    key: string;
    label: string;
    type: 'text' | 'textarea';
    visible: boolean;
    order: number;
}

