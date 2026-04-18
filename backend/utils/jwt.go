package utils

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// Claims 自定义JWT声明结构
type Claims struct {
	UserID     string `json:"user_id"`
	Username   string `json:"username"`
	RoleType   string `json:"role_type"`
	DietitianID string `json:"dietitian_id,omitempty"`
	jwt.RegisteredClaims
}

// GenerateToken 生成JWT令牌
func GenerateToken(userID, username, roleType string, dietitianID ...string) (string, error) {
	// 设置过期时间为24小时
	expirationTime := time.Now().Add(24 * time.Hour)
	
	// 创建声明
	claims := &Claims{
		UserID:   userID,
		Username: username,
		RoleType: roleType,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expirationTime),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	
	// 如果是规划师，添加dietitian_id
	if len(dietitianID) > 0 && dietitianID[0] != "" {
		claims.DietitianID = dietitianID[0]
	}
	
	// 使用密钥创建令牌
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	
	// 签名令牌
	tokenString, err := token.SignedString([]byte("secret_key")) // 实际应用中应使用环境变量中的密钥
	if err != nil {
		return "", err
	}
	
	return tokenString, nil
}

// ValidateToken 验证JWT令牌
func ValidateToken(tokenString string) (*Claims, error) {
	// 解析令牌
	claims := &Claims{}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		// 验证签名方法
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return []byte("secret_key"), nil // 实际应用中应使用环境变量中的密钥
	})
	
	if err != nil {
		return nil, err
	}
	
	if !token.Valid {
		return nil, errors.New("invalid token")
	}
	
	return claims, nil
}
