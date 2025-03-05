pub struct WebSocketServerJS {
	address: Url,
	ws: web_sys::WebSocket,
	receive_queue: Arc<Mutex<VecDeque<u8>>>,
	logger: Option<Rc<RefCell<Logger>>>,
	wait_for_state_change: Arc<Notify>,
	state: Rc<RefCell<SocketState>>,
}

impl WebSocketServerJS {

}