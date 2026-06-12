"""
A2.6 - Test truy vấn ChromaDB sau khi index.

Cách dùng:
    python test_retrieval.py "Hồ sơ xin cấp lại CCCD bị mất gồm những gì?"
"""
import argparse
import time
from pathlib import Path

import chromadb
from sentence_transformers import SentenceTransformer
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
load_dotenv(ROOT_DIR / ".env")

EMBEDDING_MODEL = "intfloat/multilingual-e5-base"
COLLECTION_NAME = "tthc_documents"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("query")
    parser.add_argument("--top-k", type=int, default=5)
    parser.add_argument("--host", default="localhost")
    parser.add_argument("--port", type=int, default=8001)
    args = parser.parse_args()

    client = chromadb.HttpClient(host=args.host, port=args.port)
    collection = client.get_collection(COLLECTION_NAME)
    print(f"Tổng số chunk trong collection: {collection.count()}")

    print("Đang tải model embedding...")
    embedding_model = SentenceTransformer(EMBEDDING_MODEL)

    query_vector = [
        embedding_model.encode(f"query: {args.query}", normalize_embeddings=True).tolist()
    ]

    start = time.time()
    results = collection.query(query_embeddings=query_vector, n_results=args.top_k)
    elapsed = (time.time() - start) * 1000

    print(f"\nQuery: {args.query!r}")
    print(f"Thời gian truy vấn: {elapsed:.1f} ms\n")

    for rank, (doc, meta, dist) in enumerate(
        zip(results["documents"][0], results["metadatas"][0], results["distances"][0]), 1
    ):
        print(f"--- #{rank} (distance={dist:.4f}) ---")
        print(f"Mã TTHC: {meta['ma_thu_tuc']} | {meta['ten_thu_tuc']}")
        print(f"Bộ ngành: {meta['bo_nganh']} | Section: {meta['section_title']}")
        print(f"Nội dung: {doc[:300]}...")
        print()


if __name__ == "__main__":
    main()