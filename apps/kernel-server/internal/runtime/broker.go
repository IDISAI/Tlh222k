package runtime

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/lh222k/kernel-server/internal/sessions"
)

const maxBrokerResponseBytes = 1 << 20

type BrokerRuntime struct {
	baseURL string
	token   string
	client  *http.Client
}

func NewBrokerRuntime(rawURL, token string, client *http.Client) (*BrokerRuntime, error) {
	parsed, err := url.Parse(rawURL)
	if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.Host == "" || parsed.User != nil || parsed.RawQuery != "" || parsed.Fragment != "" {
		return nil, errors.New("broker URL must be an absolute HTTP(S) URL without credentials, query, or fragment")
	}
	token = strings.TrimSpace(token)
	if token == "" {
		return nil, errors.New("broker token is required")
	}
	if client == nil {
		client = &http.Client{Timeout: 3 * time.Minute}
	}
	return &BrokerRuntime{baseURL: strings.TrimRight(parsed.String(), "/"), token: token, client: client}, nil
}

func (r *BrokerRuntime) Start(ctx context.Context, request sessions.StartRequest) (sessions.RuntimeHandle, error) {
	body := struct {
		SessionID string `json:"sessionId"`
		Profile   string `json:"profile"`
	}{SessionID: request.SessionID, Profile: request.Profile}
	var handle sessions.RuntimeHandle
	if err := r.do(ctx, http.MethodPost, "/v1/sessions", body, &handle); err != nil {
		return sessions.RuntimeHandle{}, fmt.Errorf("broker start: %w", err)
	}
	if handle.ID == "" || handle.Endpoint == "" || handle.Token == "" {
		return sessions.RuntimeHandle{}, errors.New("broker start returned an incomplete runtime handle")
	}
	return handle, nil
}

func (r *BrokerRuntime) Stop(ctx context.Context, containerID string) error {
	if err := r.do(ctx, http.MethodDelete, "/v1/containers/"+url.PathEscape(containerID), nil, nil); err != nil {
		return fmt.Errorf("broker stop: %w", err)
	}
	return nil
}

func (r *BrokerRuntime) Alive(ctx context.Context, containerID string) bool {
	var response struct {
		Alive bool `json:"alive"`
	}
	return r.do(ctx, http.MethodGet, "/v1/containers/"+url.PathEscape(containerID)+"/alive", nil, &response) == nil && response.Alive
}

func (r *BrokerRuntime) RemoveStaleContainers(ctx context.Context) error {
	if err := r.do(ctx, http.MethodPost, "/v1/reconcile", nil, nil); err != nil {
		return fmt.Errorf("broker reconcile: %w", err)
	}
	return nil
}

func (r *BrokerRuntime) do(ctx context.Context, method, path string, body, target any) error {
	var requestBody io.Reader
	if body != nil {
		encoded, err := json.Marshal(body)
		if err != nil {
			return err
		}
		requestBody = bytes.NewReader(encoded)
	}
	request, err := http.NewRequestWithContext(ctx, method, r.baseURL+path, requestBody)
	if err != nil {
		return err
	}
	request.Header.Set("Authorization", "Bearer "+r.token)
	request.Header.Set("Accept", "application/json")
	if body != nil {
		request.Header.Set("Content-Type", "application/json")
	}
	response, err := r.client.Do(request)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		_, _ = io.Copy(io.Discard, io.LimitReader(response.Body, maxBrokerResponseBytes))
		return fmt.Errorf("broker returned status %d", response.StatusCode)
	}
	if target == nil || response.StatusCode == http.StatusNoContent {
		_, _ = io.Copy(io.Discard, io.LimitReader(response.Body, maxBrokerResponseBytes))
		return nil
	}
	limited := io.LimitReader(response.Body, maxBrokerResponseBytes+1)
	data, err := io.ReadAll(limited)
	if err != nil {
		return err
	}
	if len(data) > maxBrokerResponseBytes {
		return errors.New("broker response too large")
	}
	if err := json.Unmarshal(data, target); err != nil {
		return fmt.Errorf("decode broker response: %w", err)
	}
	return nil
}
