FROM golang:1.26-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/kernel-server ./cmd/server
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/docker-broker ./cmd/docker-broker

FROM alpine:3.22 AS kernel-server
RUN apk add --no-cache ca-certificates \
    && addgroup -g 10001 app \
    && adduser -D -u 10001 -G app app \
    && mkdir -p /app/storage/notebooks \
    && chown -R 10001:10001 /app
COPY --from=build /out/kernel-server /usr/local/bin/kernel-server
WORKDIR /app
USER 10001:10001
EXPOSE 3006
ENTRYPOINT ["kernel-server"]

FROM alpine:3.22 AS docker-broker
RUN apk add --no-cache ca-certificates docker-cli \
    && addgroup -g 10001 app \
    && adduser -D -u 10001 -G app app
COPY --from=build /out/docker-broker /usr/local/bin/docker-broker
USER 10001:10001
EXPOSE 3007
ENTRYPOINT ["docker-broker"]
