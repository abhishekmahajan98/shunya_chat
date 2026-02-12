import json
from datetime import datetime
from models import MessageOut, ConversationDetail

def test_message_validation():
    print("Testing MessageOut validation with citations and agents...")
    
    # Mock message data as it would come from Supabase
    mock_message = {
        "id": "msg-123",
        "role": "assistant",
        "content": "Hello world",
        "created_at": datetime.utcnow().isoformat(),
        "citations": [
            {"id": "1", "title": "Google", "url": "https://google.com"},
            {"id": "2", "title": "Local Doc", "url": "local://doc-456"}
        ],
        "agents": ["search", "analyzer"],
        "reasoning": {"steps": []}
    }
    
    # Validate with Pydantic model
    msg_out = MessageOut.model_validate(mock_message)
    
    assert msg_out.id == "msg-123"
    assert len(msg_out.citations) == 2
    assert msg_out.citations[0].title == "Google"
    assert msg_out.citations[0].url == "https://google.com"
    assert msg_out.citations[1].id == "2"
    assert "search" in msg_out.agents
    
    print("✓ MessageOut validation successful!")

def test_conversation_validation():
    print("Testing ConversationDetail validation...")
    
    mock_conv = {
        "id": "conv-123",
        "title": "Test Conversation",
        "model": "gemini-1.5-pro",
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
        "messages": [
            {
                "id": "msg-1",
                "role": "user",
                "content": "Hi",
                "created_at": datetime.utcnow().isoformat()
            },
            {
                "id": "msg-2",
                "role": "assistant",
                "content": "Hello",
                "created_at": datetime.utcnow().isoformat(),
                "citations": [{"id": "1", "title": "Source", "url": "http://example.com"}],
                "agents": ["search"]
            }
        ]
    }
    
    conv_detail = ConversationDetail.model_validate(mock_conv)
    assert len(conv_detail.messages) == 2
    assert conv_detail.messages[1].citations[0].title == "Source"
    
    print("✓ ConversationDetail validation successful!")

if __name__ == "__main__":
    try:
        test_message_validation()
        test_conversation_validation()
        print("\nAll model validation tests passed!")
    except Exception as e:
        print(f"\nValidation Failed: {e}")
        exit(1)
