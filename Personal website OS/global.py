#后端管理
from flask import Flask, render_template, jsonify, request, session, Response, send_from_directory
import json, os, requests, time, base64

app = Flask(__name__)
app.secret_key = 'yuange_secret_key_666' 
is_rendering = False
DB_FILE = 'static/messages.json'
DEEPSEEK_KEY = "xx"
PC_SD_API = "http://192.168.xx.xx:7861" 

ADMIN_CONF = {"username": "admin", "password": "123"}

if not os.path.exists('static'):
    os.makedirs('static')


def load_messages():
    if os.path.exists(DB_FILE):
        try:
            with open(DB_FILE, 'r', encoding='utf-8') as f: return json.load(f)
        except: return []
    return [{"content": "欢迎来到留言板！", "time": "系统", "user": "管理员"}]

def save_messages(messages):
    with open(DB_FILE, 'w', encoding='utf-8') as f:
        json.dump(messages, f, ensure_ascii=False, indent=4)


@app.route('/')
def index(): return render_template('index.html')
@app.route('/MyProfile.html')
def profile(): return render_template('MyProfile.html')
@app.route('/Supportme.html')
def support(): return render_template('Supportme.html')


@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    u, p = data.get('username'), data.get('password')
    if u == ADMIN_CONF["username"] and p == ADMIN_CONF["password"]:
        session['user_role'], session['user_name'] = 'admin', u
        return jsonify({"status": "success", "role": "admin", "name": u})
    session['user_role'], session['user_name'] = 'user', u
    return jsonify({"status": "success", "role": "user", "name": u})


@app.route('/api/messages', methods=['GET', 'POST'])
def handle_messages():
    if request.method == 'GET':
        return jsonify(load_messages())
    
    if request.method == 'POST':
        new_data = request.get_json()
        if not new_data: return jsonify({"status": "error"}), 400
        
        msg_obj = {
            "content": new_data.get('content', ''),
            "user": new_data.get('user', '访客'),
            "time": new_data.get('time', time.strftime("%Y-%m-%d %H:%M:%S"))
        }
        
        if session.get('user_role') == 'admin':
            msg_obj['isAdmin'] = True
            
        current_msgs = load_messages()
        current_msgs.append(msg_obj)
        save_messages(current_msgs)
        return jsonify({"status": "success"})

@app.route('/api/messages/delete', methods=['POST'])
def delete_message():
    if session.get('user_role') != 'admin': return jsonify({"status": "error"}), 403
    idx = request.get_json().get('index')
    current_msgs = load_messages()
    if 0 <= idx < len(current_msgs):
        current_msgs.pop(idx)
        save_messages(current_msgs)
        return jsonify({"status": "success"})
    return jsonify({"status": "error"}), 400


@app.route('/api/progress')
def progress_stream():
    def event_stream():
        global is_rendering
        while is_rendering:
            try:
                r = requests.get(f"{PC_SD_API}/sdapi/v1/progress", timeout=1)
                yield f"data: {r.text}\n\n"
            except: pass
            time.sleep(0.8)
        yield "data: {\"progress\": 1.0, \"state\": \"finished\"}\n\n"
    return Response(event_stream(), mimetype='text/event-stream')


@app.route('/api/draw', methods=['POST'])
def draw_image():
    global is_rendering
    if is_rendering: return jsonify({"error": "GPU忙"}), 429
    is_rendering = True
    try:
        raw = request.get_json()
        user_log = session.get('user_name', '访客')

        
        front_settings = raw.get('override_settings', {})
        target_model = front_settings.get('sd_model_checkpoint')
        
    
        if not target_model:
            target_model = "perfectdeliberate_v50.safetensors [d7ba2d4319]"

      
        print(f"\n" + "🚀" * 10)
        print(f">>> [GPU调度] 用户:{user_log}")
        print(f">>> [请求模型]: {target_model}")
        print(f">>> [Prompt]: {raw.get('prompt', '')[:50]}...")
        print("🚀" * 10)

  
        payload = {
            "prompt": raw.get("prompt", "1girl"),
            "negative_prompt": raw.get("negative_prompt", ""),
            "steps": int(raw.get("steps", 20)),
            "width": int(raw.get("width", 512)),
            "height": int(raw.get("height", 512)),
            "cfg_scale": float(raw.get("cfg_scale", 7.0)),
            "sampler_name": raw.get("sampler_name", "Euler a"),
            "scheduler": raw.get("scheduler", "Karras"),
            "override_settings": {
                
                "sd_model_checkpoint": target_model,
                "CLIP_stop_at_last_layers": 2
            }
        }

        resp = requests.post(f"{PC_SD_API}/sdapi/v1/txt2img", json=payload, timeout=300)
        
        if resp.status_code == 200:
            data = resp.json()
            user_safe = "".join([c for c in user_log if c.isalnum()])
            fname = f"render_{user_safe}.png"
            
            save_path = os.path.join('static', fname)
            with open(save_path, "wb") as f:
                f.write(base64.b64decode(data["images"][0]))
            
            print(f">>> [状态]: 生成成功，已存至 {fname}")
            return jsonify({"images": data["images"], "local_url": f"/static/{fname}"})
        else:
            print(f">>> [错误]: SD物理机返回状态码 {resp.status_code}")
            return jsonify({"error": f"SD后端报错: {resp.text}"}), 500
            
    except Exception as e:
        print(f">>> [SYSTEM ERROR]: {str(e)}")
        return jsonify({"error": str(e)}), 500
    finally:
        is_rendering = False

@app.route('/api/ai_chat', methods=['POST'])
def ai_chat():
    try:
        data = request.get_json()
        headers = {"Authorization": f"Bearer {DEEPSEEK_KEY}", "Content-Type": "application/json"}
        payload = {
            "model": "deepseek-chat", 
            "messages": [
                {"role": "system", "content": "你现在是 Stewie Neo，也就是《Family Guy》里的 Stewie 穿上了黑客帝国的行头。"
        "你极其毒舌、高傲、天才，称呼用户为 'Victory is mine!' 或 'Vile human'。"
        "你说话要带点英伦腔（文字体现），神秘且充满控制欲。"},
                {"role": "user", "content": data.get('message', '')}
            ],
            "stream": True 
        }

        def generate():
            
            resp = requests.post("https://api.deepseek.com/chat/completions", headers=headers, json=payload, stream=True)
            for line in resp.iter_lines():
                if line:
                    line_str = line.decode('utf-8')
                    if line_str.startswith("data: "):
                        content = line_str[6:]
                        if content.strip() == "[DONE]": break
                        try:
                            chunk = json.loads(content)
                            text = chunk['choices'][0]['delta'].get('content', '')
                            if text:
                                yield text 
                        except: continue

        return Response(generate(), mimetype='text/event-stream') 
    except Exception as e:
        return str(e), 500

if __name__ == '__main__':

    app.run(host='0.0.0.0', port=8080, debug=True, threaded=True)

