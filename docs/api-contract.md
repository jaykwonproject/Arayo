# API Contract — Korean Vocab Primer Server

## Base URL
- Local: `http://localhost:8000`
- Production: `https://korean-vocab-api.fly.dev` (TBD)

---

## POST /extract

Extracts Korean vocabulary from a YouTube video transcript.

### Request
```json
{
  "youtube_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "max_words": 20,
  "exclude_dictionary_forms": ["사랑", "하다", "있다"]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| youtube_url | string | yes | Full YouTube URL or youtu.be short URL |
| max_words | integer | no | Max words to return (default: 20) |
| exclude_dictionary_forms | string[] | no | Words the user already knows (skip these) |

### Response (200)
```json
{
  "youtube_id": "dQw4w9WgXcQ",
  "title": "Video Title from YouTube",
  "thumbnail_url": "https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg",
  "words": [
    {
      "korean": "사랑",
      "dictionary_form": "사랑",
      "english": "love; affection",
      "pos": "noun",
      "difficulty_tier": 1,
      "frequency_in_video": 5,
      "sentence_context": "사랑은 언제나 아름답다"
    }
  ],
  "meta": {
    "total_morphemes": 342,
    "unique_words": 87,
    "words_with_translations": 62,
    "words_returned": 20,
    "processing_time_ms": 450
  }
}
```

### Error Responses

**400 — Bad Request**
```json
{ "error": "invalid_url", "message": "Not a valid YouTube URL" }
```

**404 — No Subtitles**
```json
{ "error": "no_subtitles", "message": "This video does not have Korean subtitles" }
```

**500 — Server Error**
```json
{ "error": "processing_error", "message": "Failed to process transcript" }
```

---

## GET /health

Health check endpoint (also used to keep Fly.io warm).

### Response (200)
```json
{ "status": "ok", "mecab": true, "dictionary_size": 91234 }
```
