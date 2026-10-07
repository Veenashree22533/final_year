ConvoShop

A Retrieval-Augmented Generation Framework for Intent-Driven E-Commerce Product Advisory

ConvoShop is an intelligent conversational e-commerce product advisory system that helps users find and compare products using natural-language queries. Instead of relying only on traditional keyword-based filters, the system understands user intent, retrieves semantically relevant products, verifies product information, and uses a Large Language Model to provide grounded, ranked, and explainable recommendations.

📖 Project Overview

ConvoShop addresses the limitations of conventional e-commerce search systems, where users often need to manually specify multiple filters such as category, budget, features, and intended use.

The system allows users to describe their requirements naturally, such as:

> "I need a laptop for video editing under ₹80,000 with good battery life."

ConvoShop processes this query by identifying the user's requirements, generating semantic embeddings, retrieving relevant products using vector similarity search, obtaining complete product metadata, and using Retrieval-Augmented Generation (RAG) to generate a grounded recommendation.

The system combines:

- Intent Understanding
- Requirement Decomposition
- Sentence Transformer Embeddings
- Pinecone Semantic Retrieval
- MongoDB Atlas Product Metadata
- Retrieval-Augmented Generation (RAG)
- Gemini 1.5 Flash
- Explainable Product Recommendation
- Conversational Interaction

🎯 Objectives

1. Understand natural-language e-commerce queries.
2. Decompose user requirements into meaningful attributes such as category, features, budget, and use case.
3. Retrieve semantically relevant products rather than relying only on keyword matching.
4. Combine vector retrieval with complete product metadata.
5. Use RAG to provide grounded product recommendations.
6. Rank products according to the user's requirements.
7. Provide explanations for why recommended products are suitable.
8. Support conversational and multi-turn product discovery.

⚙️ How It Works

The ConvoShop pipeline follows these major stages:

```text
User Query
     ↓
Intent Understanding
     ↓
Requirement Decomposition
     ↓
Sentence Transformer Embedding
     ↓
Pinecone Semantic Retrieval
     ↓
MongoDB Atlas Product Metadata
     ↓
RAG Context Fusion
     ↓
Gemini 1.5 Flash
     ↓
Product Ranking & Explanation
     ↓
Conversational Recommendation
```

1. Intent Understanding

The user's natural-language query is analyzed to identify the actual shopping requirement.

Important attributes may include:

- Product category
- Desired features
- Budget
- Intended use
- Other contextual requirements

2. Semantic Embedding

The processed query is converted into a dense vector representation using a Sentence Transformer model.

This allows the system to capture the semantic meaning of the query rather than depending only on exact keyword matches.

3. Semantic Retrieval with Pinecone

The generated embedding is sent to Pinecone for Approximate Nearest Neighbor (ANN) semantic retrieval.

Pinecone identifies products that are semantically similar to the user's requirements.

4. Product Metadata Retrieval

The relevant product information is retrieved from MongoDB Atlas.

MongoDB provides the detailed product metadata required for the recommendation process.

5. Retrieval-Augmented Generation

The retrieved product information is combined with the user's requirements to create grounded context for the language model.

This allows the system to generate recommendations based on retrieved product information rather than relying only on the model's internal knowledge.

6. Recommendation and Ranking

Gemini 1.5 Flash evaluates the retrieved products against the user's requirements and generates ranked recommendations.

The system can explain why a particular product is suitable for the user's needs.

🧠 Why RAG?

A standalone Large Language Model may generate recommendations based on its learned knowledge, which can result in unsupported or hallucinated information.

ConvoShop uses Retrieval-Augmented Generation to ground the recommendation process using retrieved product information.

```text
User Requirement
       +
Retrieved Product Information
       ↓
     RAG
       ↓
Grounded LLM Reasoning
       ↓
Ranked Recommendation
```

RAG therefore helps improve the relevance and grounding of the generated recommendations, although it does not completely eliminate the possibility of hallucination.

🗄️ Technology Stack

Frontend

- React.js

Backend

- FastAPI

Semantic Retrieval

- Sentence Transformers
- Pinecone
- Approximate Nearest Neighbor (ANN) Search

Database

- MongoDB Atlas

Generative AI

- Gemini 1.5 Flash

Architecture

- Retrieval-Augmented Generation (RAG)
- Intent Understanding
- Semantic Search
- Explainable Recommendation

✨ Key Features

🔍 Natural Language Product Search

Users can describe what they want in normal conversational language instead of manually selecting multiple filters.

🧩 Intent-Based Requirement Understanding

The system decomposes the user's request into relevant requirements such as product category, budget, features, and use case.

🧠 Semantic Product Retrieval

Sentence Transformer embeddings and Pinecone semantic search retrieve products based on meaning and contextual similarity.

📊 Product Ranking

Retrieved products are evaluated against the user's requirements and ranked accordingly.

💡 Explainable Recommendations

The system provides reasoning behind its recommendations instead of simply displaying product names.

🛡️ Grounded Recommendations

RAG uses retrieved product information as context for the language model, helping keep recommendations grounded in available product data.

💬 Conversational Interaction

The system supports conversational product discovery and follow-up queries through session-based interaction.

🏗️ System Architecture

```text
┌─────────────────────────────┐
│       React.js Frontend     │
│  Conversational Interface   │
└──────────────┬──────────────┘
               │
               ↓
┌─────────────────────────────┐
│        FastAPI Backend      │
│    Request Orchestration    │
└──────────────┬──────────────┘
               │
               ↓
┌─────────────────────────────┐
│     Intent Understanding    │
│ Requirement Decomposition   │
└──────────────┬──────────────┘
               │
               ↓
┌─────────────────────────────┐
│   Sentence Transformer      │
│      Query Embedding        │
└──────────────┬──────────────┘
               │
               ↓
┌─────────────────────────────┐
│          Pinecone           │
│ Semantic / ANN Retrieval    │
└──────────────┬──────────────┘
               │
               ↓
┌─────────────────────────────┐
│       MongoDB Atlas         │
│   Product Metadata Store    │
└──────────────┬──────────────┘
               │
               ↓
┌─────────────────────────────┐
│        RAG Context          │
│          Fusion             │
└──────────────┬──────────────┘
               │
               ↓
┌─────────────────────────────┐
│      Gemini 1.5 Flash       │
│ Reasoning & Recommendation  │
└──────────────┬──────────────┘
               │
               ↓
┌─────────────────────────────┐
│ Ranked & Explainable Output │
└─────────────────────────────┘
```

🔄 Example

User Query

```text
I need a laptop for video editing under ₹80,000 with good battery life.
```

Processing

```text
Category  → Laptop
Budget    → ₹80,000
Use Case  → Video Editing
Feature   → Good Battery Life
```

The system then generates a semantic representation of the requirement, searches Pinecone for relevant products, retrieves detailed information from MongoDB Atlas, and provides the retrieved context to Gemini 1.5 Flash.

Output

The user receives ranked product recommendations together with explanations describing why the products match the stated requirements.

🔑 Why Pinecone + MongoDB?

The two databases serve different purposes.

Pinecone is responsible for semantic vector retrieval. It helps identify products that are relevant to the meaning of the user's query.

MongoDB Atlas stores and retrieves the complete product metadata required to provide detailed and grounded recommendations.

```text
Pinecone
   ↓
Find relevant products

MongoDB Atlas
   ↓
Get complete product information
```

Using both allows ConvoShop to combine efficient semantic retrieval with detailed product information.

🚀 Advantages

- Natural-language interaction
- Intent-driven product discovery
- Semantic rather than purely keyword-based retrieval
- Context-aware recommendations
- Product ranking
- Explainable recommendations
- Grounded LLM generation
- Conversational interaction
- Combination of vector search and structured product metadata

🔮 Future Scope

The system can be further extended with:

- Larger and more diverse product datasets
- Improved intent classification and requirement extraction
- More advanced ranking techniques
- Additional product categories
- User preference learning
- Personalized recommendations
- Real-time product availability and pricing
- Additional conversational memory capabilities
- More extensive evaluation using real-world user queries

📌 Conclusion

ConvoShop demonstrates how semantic retrieval and Large Language Models can be combined to create an intent-driven e-commerce product advisory system.

By integrating **intent understanding, Sentence Transformer embeddings, Pinecone semantic retrieval, MongoDB Atlas, Retrieval-Augmented Generation, and Gemini 1.5 Flash**, the system moves beyond conventional product filtering toward conversational, grounded, ranked, and explainable product recommendations.

👥 Project

ConvoShop: A Retrieval-Augmented Generation Framework for Intent-Driven E-Commerce Product Advisory

Developed as an academic final-year project.

---

## 📄 License

This project is developed for academic and educational purposes.
