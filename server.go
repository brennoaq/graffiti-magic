package place

import (
	"bytes"

	"encoding/base64"
	"encoding/binary"
	"encoding/csv"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"image/color"
	"image/draw"
	"image/png"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"path"
	"strconv"
	"sync"
	"time"

	"github.com/bitcoinsv/bsvd/wire"
	"github.com/btcsuite/btcd/chaincfg/chainhash"
	"github.com/libsv/go-bk/bec"
	"github.com/libsv/go-bk/crypto"

	"github.com/gorilla/websocket"
	"github.com/libsv/go-bt/v2/bscript"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  64,
	WriteBufferSize: 64,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
	Error: func(w http.ResponseWriter, req *http.Request, status int, err error) {
		log.Println(err)
		http.Error(w, "Error while trying to make websocket connection.", status)
	},
}




type Server struct {
	sync.RWMutex
	msgs      chan []byte
	close     chan int
	clients   []chan []byte
	img       draw.Image
	imgBuf    []byte
	recordBuf []byte
	enableWL  bool
	whitelist map[string]uint16
	record    draw.Image
}

func NewServer(img draw.Image, count int, enableWL bool, whitelist map[string]uint16, record draw.Image) *Server {
	log.Printf("[NewServer 4] Creating new canvas with dimensions %d x %d\n", 0, 0)

	sv := &Server{
		RWMutex:   sync.RWMutex{},
		msgs:      make(chan []byte),
		close:     make(chan int),
		clients:   make([]chan []byte, count),
		img:       img,
		enableWL:  enableWL,
		whitelist: whitelist,
		record:    record,
	}
	go sv.broadcastLoop()
	return sv
}

func (sv *Server) ServeHTTP(w http.ResponseWriter, req *http.Request) {
	log.Printf("[ServeHTTP 3] Creating new canvas with dimensions %d x %d\n", 0, 0)
	log.Printf(req.URL.Path)
	switch path.Base(req.URL.Path) {
	case "place.png":
		sv.HandleGetImage(w, req)
	case "stat":
		sv.HandleGetStat(w, req)
	case "ws":
		sv.HandleSocket(w, req)
	case "verifykey":
		sv.HandleSetKeyCookie(w, req)
	case "points":
		sv.HandleGetPoints(w, req)
	default:
		http.Error(w, "Not found.", 404)
	}
}

func (sv *Server) HandleGetImage(w http.ResponseWriter, req *http.Request) {
	b := sv.GetImageBytes() //not thread safe but it won't do anything bad
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Content-Length", strconv.Itoa(len(b)))
	w.Header().Set("Cache-Control", "no-cache, no-store")
	w.Write(b)
}

func (sv *Server) HandleGetStat(w http.ResponseWriter, req *http.Request) {
	count := 0
	for _, ch := range sv.clients {
		if ch != nil {
			count++
		}
	}
	fmt.Fprint(w, count)
}

func (sv *Server) HandleSocket(w http.ResponseWriter, req *http.Request) {
	allowDraw := true
	var id uint16 = 0
	var key string
	if sv.enableWL {
		cookie, err := req.Cookie("key")
		if err == nil {
			key = cookie.Value
			id, allowDraw = sv.whitelist[cookie.Value]
			log.Printf("Client with key %s connected.\n", cookie.Value)
			log.Printf("Client with amount %d connected.\n", id)
		} else {
			
			log.Printf("Client with key %s connected.\n", key)
			allowDraw = false
		}
	}
	sv.Lock()
	defer sv.Unlock()
	i := sv.getConnIndex()
	if i == -1 {
		log.Println("Server full.")
		http.Error(w, "Server full.", 503)
		return
	}
	conn, err := upgrader.Upgrade(w, req, nil)
	if err != nil {
		log.Println(err)
		return
	}
	ch := make(chan []byte, 8)
	sv.clients[i] = ch
	go sv.readLoop(conn, i, allowDraw, id, key)
	go sv.writeLoop(conn, ch, allowDraw)
}

func (sv *Server) HandleSetKeyCookie(w http.ResponseWriter, req *http.Request) {
	log.Printf("Setting key cookie.\n")
	if !sv.enableWL {
		http.Error(w, "Whitelist is not enabled.", 400)
		return
	}
	// key := req.URL.Query().Get("key")
	key := req.URL.Query().Get("key")
	log.Printf("KeyKeyKeyKeyKey: %s\n", key)
	log.Printf("QueryEscapeQueryEscapeQueryEscape: %s\n", url.QueryEscape(key))

	queryUne, err := url.QueryUnescape(key)
	log.Printf("queryUne: %s\n", queryUne)
	log.Printf("keyEncodedkeyEncodedkeyEncodedkeyEncoded: %s\n", key)
	if err != nil {
		log.Printf("Error decoding key: %s\n", key)
		http.Error(w, "Bad key.", 401)
		return
	}
	

	log.Printf("key: %s\n", key)
	address := req.URL.Query().Get("address")
	log.Printf("Address: %s\n", address)

	if _, ok := sv.whitelist[key]; ok {
		expiration := time.Now().Add(30 * 24 * time.Hour)
		http.SetCookie(w, &http.Cookie{
			Name:     "key",
			Value:    key,
			SameSite: http.SameSiteStrictMode,
			Expires:  expiration,
		})

		w.WriteHeader(200)
	} else {
		log.Printf("--- User is not in the Whitelist ---")
		

	
			
			

		// err := VerifyMessage(address, key, "Sign this message to connect")
		// if err != nil {
		// 	log.Printf("Error verifying signature: %v\n", err)
		// 	http.Error(w, "Signature doesn't match", 401)
		// 	return
		// }

		hasIncriptions := checkInscriptions(address)
		log.Printf("Inscriptions: %v\n", hasIncriptions)
		data := hasIncriptions["data"].(map[string]interface{})
		log.Printf("Data: %v\n", data)
		log.Printf("Data: %v\n", data["total"])
		total := data["total"].(float64)
		

		if total < 1 {
			log.Printf("Error checking inscriptions: %v\n", err)
			http.Error(w, "Error checking inscriptions", 401)
			return
		}


		if hasIncriptions == nil {
			// log.Printf("Error checking inscriptions: %v\n", err)
			http.Error(w, "Error checking inscriptions", 401)
			return
		}

		
		log.Printf("Creating new user: %s\n", key)
		updateWhitelist("./whitelist.csv", key, 1000)
		sv.whitelist[key] = 1000

		expiration := time.Now().Add(30 * 24 * time.Hour)
		http.SetCookie(w, &http.Cookie{
			Name:     "key",
			Value:    key,
			SameSite: http.SameSiteStrictMode,
			Expires:  expiration,
		})

		w.WriteHeader(200)
		
	}
}

func (sv *Server) HandleGetPoints(w http.ResponseWriter, req *http.Request) {
	if !sv.enableWL {
		http.Error(w, "Whitelist is not enabled.", 400)
		return
	}
	key := req.URL.Query().Get("key")
	whitelistPath := "./whitelist.csv"
	amount, err := readWhitelistPoints(whitelistPath, key)
	log.Printf("dsadsadsadsadasdsadasdasa")
	log.Print(err)


	if err != nil {
		http.Error(w, "Bad key.", 401)
	} 

	
	if amount == 0 {
		w.WriteHeader(203)
		w.Write([]byte(strconv.Itoa(int(amount))))
		return 
	} 

	
	w.Write([]byte(strconv.Itoa(int(amount))))
	w.WriteHeader(200)
}

func (sv *Server) getConnIndex() int {
	for i, client := range sv.clients {
		if client == nil {
			return i
		}
	}
	return -1
}

func rateLimiter() func() bool {
	const rate = 8   // per second average
	const min = 0.01 // kick threshold

	// Minimum time difference between messages
	// Network sometimes delivers two messages in quick succession
	const minDif = int64(time.Millisecond * 50)

	last := time.Now().UnixNano()
	var v float32 = 1.0
	return func() bool {
		now := time.Now().UnixNano()
		dif := now - last
		if dif < minDif {
			dif = minDif
		}
		v *= float32(rate*dif) / float32(time.Second)
		if v > 1.0 {
			v = 1.0
		}
		last = now
		return v > min
	}
}

func (sv *Server) readLoop(conn *websocket.Conn, i int, allowDraw bool, id uint16, key string) {
	limiter := rateLimiter()
	
	for {
		_, p, err := conn.ReadMessage()
		if err != nil {
			break
		}
		if !allowDraw {
			log.Println("Client kicked for trying to draw without permission.")
			break
		}
		if !limiter() {
			log.Println("Client kicked for high rate.")
			break
		}
		if sv.handleMessage(p, id, key) != nil {
			log.Println("Client kicked for bad message.")
			break
		}
	}
	sv.close <- i
}

func (sv *Server) writeLoop(conn *websocket.Conn, ch chan []byte, allowDraw bool) {
	allowData := []byte{0}
	if allowDraw {
		allowData[0] = 1
	}
	conn.WriteMessage(websocket.BinaryMessage, allowData)
	for {
		if p, ok := <-ch; ok {
			conn.WriteMessage(websocket.BinaryMessage, p)
		} else {
			break
		}
	}
	conn.Close()
}

func (sv *Server) handleMessage(p []byte, id uint16, key string) error {
	x, y, c := parseEvent(p)
	if !sv.setPixel(x, y, c, id, key) {
		return errors.New("invalid placement")
	}
	sv.msgs <- p
	return nil
}

func (sv *Server) broadcastLoop() {
	for {
		select {
		case i := <-sv.close:
			if sv.clients[i] != nil {
				close(sv.clients[i])
				sv.clients[i] = nil
			}
		case p := <-sv.msgs:
			for i, ch := range sv.clients {
				if ch != nil {
					select {
					case ch <- p:
					default:
						close(ch)
						sv.clients[i] = nil
					}
				}
			}
		}
	}
}

func (sv *Server) GetImageBytes() []byte {
	if sv.imgBuf == nil {
		buf := bytes.NewBuffer(nil)
		if err := png.Encode(buf, sv.img); err != nil {
			log.Println(err)
		}
		sv.imgBuf = buf.Bytes()
	}
	return sv.imgBuf
}

func (sv *Server) GetRecordBytes() []byte {
	if !sv.enableWL {
		panic("Tried to get record bytes when whitelist is disabled.")
	}
	if sv.recordBuf == nil {
		buf := bytes.NewBuffer(nil)
		if err := png.Encode(buf, sv.record); err != nil {
			log.Println(err)
		}
		sv.recordBuf = buf.Bytes()
	}
	return sv.recordBuf
}

func (sv *Server) setPixel(x, y int, c color.Color, id uint16, key string) bool {
	whitelistPath := "./whitelist.csv"
	amount, err := readWhitelistPoints(whitelistPath, key)
	log.Printf("[setPixel] Amount with amount %d requested.\n", amount)

	if amount == 0 {
		return false
	}

	if err != nil {
		log.Fatal(err)
	}
	
	rect := sv.img.Bounds()
	width := rect.Max.X - rect.Min.X
	height := rect.Max.Y - rect.Min.Y
	if 0 > x || x >= width || 0 > y || y >= height {
		return false
	}
	sv.img.Set(x, y, c)
	sv.imgBuf = nil
	if sv.enableWL {
		sv.record.Set(x, y, color.Gray16{id})
		sv.recordBuf = nil
	}
	
	
	
	error := updateWhitelist(whitelistPath, key, amount - 1)
	if error != nil {
		log.Fatal(error)
	}
	
	log.Printf("Amount with amount %d updated.\n", amount - 1)
	return true
}

func parseEvent(b []byte) (int, int, color.Color) {
	if len(b) != 11 {
		return -1, -1, nil
	}
	x := int(binary.BigEndian.Uint32(b))
	y := int(binary.BigEndian.Uint32(b[4:]))
	return x, y, color.NRGBA{b[8], b[9], b[10], 0xFF}
}

func updateWhitelist(whitelistPath string, key string, amount uint16) error {
    f, err := os.OpenFile(whitelistPath, os.O_RDWR|os.O_CREATE, 0666)
    if err != nil {
        log.Fatal(err)
    }
    defer f.Close()

    csvReader := csv.NewReader(f)
    data, err := csvReader.ReadAll()
    if err != nil {
        log.Fatal(err)
    }

    // Update or add the key with the new amount
    found := false
    for i, v := range data {
        if v[0] == key {
            data[i][1] = strconv.Itoa(int(amount))
            found = true
            break
        }
    }
    if !found {
        data = append(data, []string{key, strconv.Itoa(int(amount))})
    }

    // Move back to the beginning of the file to overwrite with the updated data
    _, err = f.Seek(0, io.SeekStart)
    if err != nil {
        log.Fatal(err)
    }
    // Truncate the file to remove old content
    err = f.Truncate(0)
    if err != nil {
        log.Fatal(err)
    }

    csvWriter := csv.NewWriter(f)
    err = csvWriter.WriteAll(data) // Writes all data at once
    if err != nil {
        log.Fatal(err)
    }
    csvWriter.Flush()
    return nil
}

func readWhitelistPoints(whitelistPath string, key string) (uint16, error) {
	f, err := os.Open(whitelistPath)
	if err != nil {
		log.Fatal(err)
	}
	defer f.Close()
	csvReader := csv.NewReader(f)
	data, err := csvReader.ReadAll()
	if err != nil {
		log.Fatal(err)
		return 0, err
	}
	whitelist := make(map[string]uint16)
	for line, v := range data {
		x, err := strconv.Atoi(v[1])
		if err != nil {
			panic(fmt.Sprintf("Error when reading whitelist on line %d: %s", line, err.Error()))
		}
		whitelist[v[0]] = uint16(x)
	}
	return whitelist[key], nil
}

func checkInscriptions(address string) map[string]interface{} {	
	log.Printf("Checking inscriptions for address: %s\n", address)
	url := fmt.Sprintf("https://open-api.unisat.io/v1/indexer/address/%s/inscription-data", address)

	// Create a new request using http
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		fmt.Println("Error creating request:", err)
		return nil
	}

	headerValue := os.Getenv("UNISAT_API_KEY")

	req.Header.Add("Authorization", "Bearer " + headerValue)

	// Send the request
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		fmt.Println("Error sending request:", err)
		return nil
	}
	defer resp.Body.Close()

	var data map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		fmt.Println("Error decoding JSON:", err)
		return nil
	}

	// fmt.Println("Data received:", data)

	return data
}

const (
	hBSV string = "Bitcoin Signed Message:\n"
)

func PubKeyFromSignature(sig, data string) (pubKey *bec.PublicKey, wasCompressed bool, err error) {

	var decodedSig []byte
	if decodedSig, err = base64.StdEncoding.DecodeString(sig); err != nil {
		return nil, false, err
	}

	var buf bytes.Buffer
	if err = wire.WriteVarString(&buf, 0, hBSV); err != nil {
		return nil, false, err
	}
	if err = wire.WriteVarString(&buf, 0, data); err != nil {
		return nil, false, err
	}

	expectedMessageHash := chainhash.DoubleHashB(buf.Bytes())
	return bec.RecoverCompact(bec.S256(), decodedSig, expectedMessageHash)
}

func VerifyMessage(address, sig, data string) error {
	publicKey, wasCompressed, err := PubKeyFromSignature(sig, data)
	
	if err != nil {
		return err
	}

	// Get the address
	var bscriptAddress *bscript.Address
	if bscriptAddress, err = GetAddressFromPubKey(publicKey, wasCompressed); err != nil {
		return err
	}

	if bscriptAddress.AddressString == address {
		log.Printf("Address (%s) found - compressed: %t\n", address, wasCompressed)
		return nil
	}

	return fmt.Errorf(
		"address (%s) not found - compressed: %t\n%s was found instead",
		address,
		wasCompressed,
		bscriptAddress.AddressString,
	)
}

func GetAddressFromPubKey(publicKey *bec.PublicKey, compressed bool) (*bscript.Address, error) {
	if publicKey == nil {
		return nil, fmt.Errorf("publicKey cannot be nil")
	} else if publicKey.X == nil {
		return nil, fmt.Errorf("publicKey.X cannot be nil")
	}

	if !compressed {
		hash := crypto.Hash160(publicKey.SerialiseUncompressed())
		bb := make([]byte, 1)
		bb = append(bb, hash...)
		return &bscript.Address{
			AddressString: bscript.Base58EncodeMissingChecksum(bb),
			PublicKeyHash: hex.EncodeToString(hash),
		}, nil
	}

	return bscript.NewAddressFromPublicKey(publicKey, true)
}