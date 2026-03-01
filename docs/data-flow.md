
### 単語の取得

```mermaid
sequenceDiagram
    autonumber
    participant App as Mobile App
    participant API as API (Hono)
    participant Redis as Upstash Redis<br/>(User Cache)
    participant DB as Turso (Main DB)

    Note over App, DB: 1. 単語リスト取得（自分用キャッシュ）

    App->>API: GET /words

    API->>Redis: GET user:{uid}:words:list

    alt キャッシュヒット (高速)
        Redis-->>API: JSON Data
    else キャッシュミス (初回/更新後)
        Redis-->>API: null
        API->>DB: SELECT * FROM words WHERE user_id = ...
        DB-->>API: Words Data
        API->>Redis: SETEX user:{uid}:words:list 3600 (Data)
    end

    API-->>App: 200 OK (Words List)
```

### 単語の追加

キャッシュをredis保存にしているがデータベースにした方がよい。

```mermaid
sequenceDiagram
    autonumber
    participant App as Mobile App
    participant API as API (Hono)
    participant Redis as Upstash Redis<br/>(Global Cache)
    participant DB as Turso (Main DB)
    participant Q as Queue
    participant W as Worker
    participant AI as Gemini 2.5

    Note over App, AI: 2. 単語登録（共有キャッシュ活用）

    App->>API: POST /words (text="ephemeral", is_public=true)

    Note right of API: まず共有キャッシュを確認
    API->>Redis: GET global:meaning:ephemeral:ja

    alt キャッシュヒット (誰かが既に生成済み)
        Redis-->>API: { meaning: "短命な...", example: "..." }
        Note right of API: AIを呼ばずに完了とする
        API->>DB: INSERT (status="done", 意味データ含む)
        DB-->>API: New ID
        API->>Redis: DEL user:{uid}:words:list (リストキャッシュ削除)
        API-->>App: 201 Created (完了状態)

    else キャッシュミス (未知の単語)
        Redis-->>API: null
        Note right of API: とりあえず枠だけ作る
        API->>DB: INSERT (status="pending")
        API->>Q: Enqueue (word="ephemeral", is_public=true)
        API-->>App: 201 Created (補完中)

        Note right of Q: ここから非同期 (裏側)
        Q->>W: ジョブ取得
        W->>AI: 生成リクエスト
        AI-->>W: 生成結果

        par DB更新・ベクトル化・キャッシュ共有
            W->>DB: UPDATE (status="done", result)
            W->>DB: (Vector Upsert...)

            alt ユーザーが公開を許可 (is_public)
                W->>Redis: SET global:meaning:ephemeral:ja (result)
                Note right of W: 次のユーザーのために保存
            end
        end
    end
```

### 4択クイズ生成

```mermaid
sequenceDiagram
    autonumber
    participant App as Mobile App
    participant API as API (Hono)
    participant DB as Turso (DB)
    participant Vec as Turso Vector

    Note over App, Vec: 3. クイズ出題フロー

    App->>API: GET /quiz (出題要求)

    Note right of API: ① 正解の決定
    API->>DB: 忘却曲線/スケジュールから正解語彙を選択
    DB-->>API: 正解データ (Target Word)

    Note right of API: ② ダミー選択肢の取得
    API->>Vec: 正解語のVectorで近傍検索 (Limit 10)
    Vec-->>API: 近い単語のIDリスト (Candidate IDs)

    Note right of API: ③ 4択の構築
    API->>DB: Candidate IDsの詳細情報を取得
    DB-->>API: 詳細データ
    API->>API: 正解1 + ダミー3 をランダム構成

    API-->>App: クイズデータ (4択)

    App->>App: ユーザー回答
    App->>API: POST /quiz/answer (結果送信)
    API->>DB: 正誤記録・次回スケジュール更新
```


### 画像アップロード

```mermaid
sequenceDiagram
    autonumber
    participant App as Mobile App
    participant API as API (Hono)
    participant R2 as Cloudflare R2
    participant DB as Turso (DB)

    Note over App, DB: 4. 画像アップロード

    App->>API: POST /upload/presign (拡張子等)
    API->>R2: 署名付きPUT URL発行要求
    R2-->>API: Signed URL
    API-->>App: Signed URL + Object Key

    Note right of App: モバイルから直接R2へ
    App->>R2: PUT (画像バイナリ)
    R2-->>App: 200 OK

    Note right of App: DB紐付け
    App->>API: PATCH /words/{id} (image_key, meta)
    API->>DB: 画像パスとメタデータを保存
    API-->>App: 更新完了
```
