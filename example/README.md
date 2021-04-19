# Full stack example

- Express
- Mongo
- Redis

## Test locally

```sh
docker compose up backend
```

## Available endpoints

- `http://localhost:3000/`: to test HTTP server
- `http://localhost:3000/mongo-example`: list items in mongo db
- `http://localhost:3000/mongo-example/add`: add an item in mongo db
- `http://localhost:3000/mongo-example/del`: delete an item in mongo db
- `http://localhost:3000/redis-example`: list items in redis
- `http://localhost:3000/redis-example/set`: set an item in redis
- `http://localhost:3000/redis-example/del`: delete an item in redis
