import os

# Load local .env if it exists (for local testing)
if os.path.exists('.env'):
    with open('.env', encoding='utf-8') as f:
        for line in f:
            if '=' in line and not line.startswith('#'):
                key, val = line.strip().split('=', 1)
                os.environ[key.strip()] = val.strip()

import hashlib
import secrets
import requests
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
import pusher

app = Flask(__name__)
CORS(app)

# Credentials
YOUTUBE_API_KEY = os.environ.get('YOUTUBE_API_KEY')
SUPABASE_URL = os.environ.get('SUPABASE_URL', 'https://ckxttnxirqiqzdkpxknw.supabase.co')
SUPABASE_KEY = os.environ.get('SUPABASE_KEY')

PUSHER_APP_ID = os.environ.get('PUSHER_APP_ID', '2176447')
PUSHER_KEY = os.environ.get('PUSHER_KEY', '745a886dc8b366f59ca7')
PUSHER_SECRET = os.environ.get('PUSHER_SECRET')
PUSHER_CLUSTER = os.environ.get('PUSHER_CLUSTER', 'ap2')

pusher_client = pusher.Pusher(
    app_id=PUSHER_APP_ID,
    key=PUSHER_KEY,
    secret=PUSHER_SECRET,
    cluster=PUSHER_CLUSTER,
    ssl=True
)

# Supabase REST client helpers
def sb_headers():
    return {
        'apikey': SUPABASE_KEY,
        'Authorization': f'Bearer {SUPABASE_KEY}',
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
    }

def sb_get(table, params=None):
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    res = requests.get(url, headers=sb_headers(), params=params)
    return res.json() if res.status_code in [200, 201] else []

def sb_post(table, data):
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    res = requests.post(url, headers=sb_headers(), json=data)
    if res.status_code in [200, 201]:
        return res.json()
    return None

def sb_patch(table, filters, data):
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    headers = sb_headers()
    # filters is a dict like {'id': 'eq.123'}
    res = requests.patch(url, headers=headers, params=filters, json=data)
    return res.json() if res.status_code in [200, 201] else None

def sb_delete(table, filters):
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    res = requests.delete(url, headers=sb_headers(), params=filters)
    return res.status_code in [200, 204]

def hash_password(password, salt=None):
    if salt is None:
        salt = secrets.token_hex(16)
    pw_hash = hashlib.sha256((salt + password).encode()).hexdigest()
    return pw_hash, salt

# ─── Auth Routes ─────────────────────────────────────────────────────────────

@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.get_json() or {}
    username = (data.get('username') or '').strip()
    password = data.get('password') or ''

    if not username or not password:
        return jsonify({'error': 'Username and password are required.'}), 400
    if len(username) < 3:
        return jsonify({'error': 'Username must be at least 3 characters.'}), 400
    if len(password) < 4:
        return jsonify({'error': 'Password must be at least 4 characters.'}), 400

    # Check if user already exists
    existing = sb_get('users', {'username': f'eq.{username}'})
    if existing:
        return jsonify({'error': 'Username already taken.'}), 409

    pw_hash, salt = hash_password(password)
    new_user = sb_post('users', {
        'username': username,
        'password_hash': pw_hash,
        'salt': salt
    })
    if new_user:
        return jsonify({'success': True, 'userId': new_user[0]['id'], 'username': username})
    return jsonify({'error': 'Failed to create user.'}), 500

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    username = (data.get('username') or '').strip()
    password = data.get('password') or ''

    if not username or not password:
        return jsonify({'error': 'Username and password are required.'}), 400

    users = sb_get('users', {'username': f'eq.{username}'})
    if not users:
        return jsonify({'error': 'Invalid username or password.'}), 401

    user = users[0]
    pw_hash, _ = hash_password(password, user['salt'])
    if pw_hash != user['password_hash']:
        return jsonify({'error': 'Invalid username or password.'}), 401

    return jsonify({'success': True, 'userId': user['id'], 'username': username})

@app.route('/api/history')
def get_history():
    user_id = request.args.get('user_id')
    if not user_id:
        return jsonify({'rooms': []})

    # Get last 5 rooms
    history = sb_get('room_history', {
        'user_id': f'eq.{user_id}',
        'order': 'last_visited.desc',
        'limit': 5
    })
    return jsonify({'rooms': [{'roomId': h['room_id'], 'lastVisited': h['last_visited']} for h in history]})

# ─── Room Routes ─────────────────────────────────────────────────────────────

def record_room_history(user_id, room_id):
    if not user_id:
        return
    # Delete old
    sb_delete('room_history', {'user_id': f'eq.{user_id}', 'room_id': f'eq.{room_id}'})
    # Insert new
    sb_post('room_history', {'user_id': user_id, 'room_id': room_id})

@app.route('/api/rooms/create', methods=['POST'])
def create_room():
    data = request.get_json() or {}
    username = data.get('username', 'Anonymous')
    user_id = data.get('userId')

    # Generate room code
    room_id = ''.join(secrets.choice('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789') for _ in range(6))
    
    # Create room
    sb_post('rooms', {
        'id': room_id,
        'host_user_id': user_id
    })

    # Add member
    sb_post('room_members', {
        'room_id': room_id,
        'user_id': user_id,
        'username': username,
        'is_host': True
    })

    if user_id:
        record_room_history(user_id, room_id)

    return jsonify({'success': True, 'roomId': room_id, 'isHost': True})

@app.route('/api/rooms/join', methods=['POST'])
def join_room_api():
    data = request.get_json() or {}
    room_id = data.get('roomId', '').strip().toUpperCase() if hasattr(data.get('roomId', ''), 'toUpperCase') else data.get('roomId', '').strip().upper()
    username = data.get('username', 'Anonymous')
    user_id = data.get('userId')

    rooms = sb_get('rooms', {'id': f'eq.{room_id}'})
    if not rooms:
        return jsonify({'error': 'Room not found.'}), 404

    # Remove existing membership for this user in this room to avoid duplicates
    if user_id:
        sb_delete('room_members', {'room_id': f'eq.{room_id}', 'user_id': f'eq.{user_id}'})
    else:
        sb_delete('room_members', {'room_id': f'eq.{room_id}', 'username': f'eq.{username}'})

    # Add member
    sb_post('room_members', {
        'room_id': room_id,
        'user_id': user_id,
        'username': username,
        'is_host': False
    })

    if user_id:
        record_room_history(user_id, room_id)

    # Get members
    members = sb_get('room_members', {'room_id': f'eq.{room_id}'})
    user_list = [{'username': m['username'], 'is_host': m['is_host']} for m in members]

    # Trigger Pusher event to notify others
    pusher_client.trigger(f'presence-room-{room_id}', 'user-joined', {
        'username': username,
        'userList': user_list
    })

    # Trigger system chat message
    pusher_client.trigger(f'presence-room-{room_id}', 'new-message', {
        'username': 'System',
        'message': f'{username} joined the room',
        'timestamp': datetime.now().timestamp() * 1000,
        'isSystem': True
    })

    # Get current queue
    queue_items = sb_get('queue', {'room_id': f'eq.{room_id}', 'order': 'position.asc'})
    queue_list = [{'videoId': q['video_id'], 'title': q['video_title'], 'position': q['position']} for q in queue_items]

    room = rooms[0]
    return jsonify({
        'success': True,
        'roomId': room_id,
        'isHost': False,
        'state': {
            'videoId': room['video_id'],
            'currentTime': room['current_time'],
            'isPlaying': room['is_playing'],
            'backgroundPlay': room['background_play'],
            'timestamp': datetime.now().timestamp() * 1000,
            'userList': user_list,
            'queue': queue_list
        }
    })

@app.route('/api/rooms/state')
def get_room_state():
    room_id = request.args.get('room_id')
    rooms = sb_get('rooms', {'id': f'eq.{room_id}'})
    if not rooms:
        return jsonify({'error': 'Room not found'}), 404
    room = rooms[0]
    members = sb_get('room_members', {'room_id': f'eq.{room_id}'})
    queue_items = sb_get('queue', {'room_id': f'eq.{room_id}', 'order': 'position.asc'})

    return jsonify({
        'videoId': room['video_id'],
        'currentTime': room['current_time'],
        'isPlaying': room['is_playing'],
        'backgroundPlay': room['background_play'],
        'userList': [{'username': m['username'], 'is_host': m['is_host']} for m in members],
        'queue': [{'videoId': q['video_id'], 'title': q['video_title'], 'position': q['position']} for q in queue_items]
    })

@app.route('/api/rooms/video', methods=['POST'])
def load_video_api():
    data = request.get_json() or {}
    room_id = data.get('roomId')
    video_id = data.get('videoId')
    current_time = data.get('currentTime', 0)

    sb_patch('rooms', {'id': f'eq.{room_id}'}, {
        'video_id': video_id,
        'current_time': current_time,
        'is_playing': False
    })

    pusher_client.trigger(f'presence-room-{room_id}', 'video-loaded', {
        'videoId': video_id,
        'currentTime': current_time,
        'isPlaying': False,
        'timestamp': datetime.now().timestamp() * 1000
    })
    return jsonify({'success': True})

@app.route('/api/rooms/playback', methods=['POST'])
def playback_api():
    data = request.get_json() or {}
    room_id = data.get('roomId')
    action = data.get('action') # 'play' or 'pause'
    current_time = data.get('currentTime', 0)

    is_playing = (action == 'play')
    sb_patch('rooms', {'id': f'eq.{room_id}'}, {
        'current_time': current_time,
        'is_playing': is_playing
    })

    pusher_client.trigger(f'presence-room-{room_id}', action, {
        'currentTime': current_time,
        'timestamp': datetime.now().timestamp() * 1000
    })
    return jsonify({'success': True})

@app.route('/api/rooms/heartbeat', methods=['POST'])
def heartbeat_api():
    data = request.get_json() or {}
    room_id = data.get('roomId')
    current_time = data.get('currentTime', 0)
    is_playing = data.get('isPlaying', False)
    socket_id = data.get('socketId')

    # Update database state quietly
    sb_patch('rooms', {'id': f'eq.{room_id}'}, {
        'current_time': current_time
    })

    # Broadcast sync-check to other members
    pusher_client.trigger(
        f'presence-room-{room_id}', 
        'sync-check', 
        {
            'currentTime': current_time,
            'isPlaying': is_playing,
            'timestamp': datetime.now().timestamp() * 1000
        },
        socket_id # skip sender
    )
    return jsonify({'success': True})

# ─── Queue Routes ─────────────────────────────────────────────────────────────

@app.route('/api/rooms/queue/add', methods=['POST'])
def add_to_queue_api():
    data = request.get_json() or {}
    room_id = data.get('roomId')
    video_id = data.get('videoId')
    title = data.get('title')

    # Get current queue to find next position
    existing = sb_get('queue', {'room_id': f'eq.{room_id}'})
    position = len(existing)

    sb_post('queue', {
        'room_id': room_id,
        'video_id': video_id,
        'video_title': title,
        'position': position
    })

    # Get updated queue
    updated = sb_get('queue', {'room_id': f'eq.{room_id}', 'order': 'position.asc'})
    queue_list = [{'videoId': q['video_id'], 'title': q['video_title'], 'position': q['position']} for q in updated]

    pusher_client.trigger(f'presence-room-{room_id}', 'queue-update', queue_list)
    return jsonify({'success': True})

@app.route('/api/rooms/queue/remove', methods=['POST'])
def remove_from_queue_api():
    data = request.get_json() or {}
    room_id = data.get('roomId')
    position = data.get('position')

    # Delete
    sb_delete('queue', {'room_id': f'eq.{room_id}', 'position': f'eq.{position}'})

    # Reorder remaining
    remaining = sb_get('queue', {'room_id': f'eq.{room_id}', 'order': 'position.asc'})
    for i, item in enumerate(remaining):
        sb_patch('queue', {'id': f'eq.{item["id"]}'}, {'position': i})

    # Get final queue
    updated = sb_get('queue', {'room_id': f'eq.{room_id}', 'order': 'position.asc'})
    queue_list = [{'videoId': q['video_id'], 'title': q['video_title'], 'position': q['position']} for q in updated]

    pusher_client.trigger(f'presence-room-{room_id}', 'queue-update', queue_list)
    return jsonify({'success': True})

@app.route('/api/rooms/queue/play-next', methods=['POST'])
def play_next_api():
    data = request.get_json() or {}
    room_id = data.get('roomId')

    # Get queue
    queue = sb_get('queue', {'room_id': f'eq.{room_id}', 'order': 'position.asc'})
    if not queue:
        return jsonify({'error': 'Queue is empty'}), 400

    next_video = queue[0]

    # Delete first item
    sb_delete('queue', {'id': f'eq.{next_video["id"]}'})

    # Reorder others
    remaining = sb_get('queue', {'room_id': f'eq.{room_id}', 'order': 'position.asc'})
    for i, item in enumerate(remaining):
        sb_patch('queue', {'id': f'eq.{item["id"]}'}, {'position': i})

    # Update room video
    sb_patch('rooms', {'id': f'eq.{room_id}'}, {
        'video_id': next_video['video_id'],
        'current_time': 0,
        'is_playing': True
    })

    # Broadcast updates
    pusher_client.trigger(f'presence-room-{room_id}', 'video-loaded', {
        'videoId': next_video['video_id'],
        'currentTime': 0,
        'isPlaying': True,
        'timestamp': datetime.now().timestamp() * 1000
    })

    updated = sb_get('queue', {'room_id': f'eq.{room_id}', 'order': 'position.asc'})
    queue_list = [{'videoId': q['video_id'], 'title': q['video_title'], 'position': q['position']} for q in updated]
    pusher_client.trigger(f'presence-room-{room_id}', 'queue-update', queue_list)

    return jsonify({'success': True})

@app.route('/api/rooms/background-play', methods=['POST'])
def toggle_bg_play_api():
    data = request.get_json() or {}
    room_id = data.get('roomId')
    enabled = data.get('enabled', False)

    sb_patch('rooms', {'id': f'eq.{room_id}'}, {'background_play': enabled})
    pusher_client.trigger(f'presence-room-{room_id}', 'background-play-update', {'enabled': enabled})
    return jsonify({'success': True})

# ─── Chat & Leave Routes ──────────────────────────────────────────────────────

@app.route('/api/chat', methods=['POST'])
def send_chat_message():
    data = request.get_json() or {}
    room_id = data.get('roomId')
    username = data.get('username')
    message = data.get('message', '').strip()
    socket_id = data.get('socketId')

    if not message:
        return jsonify({'error': 'Message is empty'}), 400

    pusher_client.trigger(f'presence-room-{room_id}', 'new-message', {
        'username': username,
        'message': message,
        'timestamp': datetime.now().timestamp() * 1000,
        'senderId': socket_id
    })
    return jsonify({'success': True})

@app.route('/api/rooms/leave', methods=['POST'])
def leave_room_api():
    data = request.get_json() or {}
    room_id = data.get('roomId')
    username = data.get('username')

    # Remove from member list
    sb_delete('room_members', {'room_id': f'eq.{room_id}', 'username': f'eq.{username}'})

    # Get remaining members
    members = sb_get('room_members', {'room_id': f'eq.{room_id}'})
    user_list = [{'username': m['username'], 'is_host': m['is_host']} for m in members]

    # Trigger Pusher user-left
    pusher_client.trigger(f'presence-room-{room_id}', 'user-left', {
        'username': username,
        'userList': user_list
    })

    # System chat msg
    pusher_client.trigger(f'presence-room-{room_id}', 'new-message', {
        'username': 'System',
        'message': f'{username} left the room',
        'timestamp': datetime.now().timestamp() * 1000,
        'isSystem': True
    })

    # If room empty, clean up
    if not members:
        sb_delete('rooms', {'id': f'eq.{room_id}'})
        sb_delete('queue', {'room_id': f'eq.{room_id}'})

    return jsonify({'success': True})

# ─── Pusher Channel Auth ──────────────────────────────────────────────────────

@app.route('/api/pusher/auth', methods=['POST'])
def pusher_auth():
    # Pusher subscription authentication for private/presence channels
    channel_name = request.form.get('channel_name')
    socket_id = request.form.get('socket_id')
    custom_data = {
        'user_id': socket_id,
        'user_info': {
            'username': request.form.get('username', 'Anonymous')
        }
    }
    auth = pusher_client.authenticate(
        channel=channel_name,
        socket_id=socket_id,
        custom_data=custom_data
    )
    return jsonify(auth)

# ─── YouTube Search Proxy ─────────────────────────────────────────────────────

@app.route('/api/search')
def youtube_search():
    query = request.args.get('q', '').strip()
    if not query:
        return jsonify({'items': []})

    if not YOUTUBE_API_KEY or YOUTUBE_API_KEY == 'YOUR_YOUTUBE_API_KEY_HERE':
        return jsonify({'error': 'YouTube API Key is not configured on the server.'}), 500

    url = 'https://www.googleapis.com/youtube/v3/search'
    params = {
        'part': 'snippet',
        'maxResults': 8,
        'type': 'video',
        'q': query,
        'key': YOUTUBE_API_KEY
    }

    try:
        response = requests.get(url, params=params, timeout=10)
        if response.status_code != 200:
            return jsonify({'error': f"YouTube API returned error code {response.status_code}"}), response.status_code

        data = response.json()
        items = []
        for raw_item in data.get('items', []):
            snippet = raw_item.get('snippet', {})
            video_id = raw_item.get('id', {}).get('videoId')
            if video_id:
                items.append({
                    'videoId': video_id,
                    'title': snippet.get('title'),
                    'thumbnailUrl': snippet.get('thumbnails', {}).get('default', {}).get('url'),
                    'channelTitle': snippet.get('channelTitle')
                })
        return jsonify({'items': items})
    except Exception as e:
        return jsonify({'error': f"Failed to connect to YouTube API: {str(e)}"}), 500

if __name__ == '__main__':
    app.run(debug=True, port=9000)
