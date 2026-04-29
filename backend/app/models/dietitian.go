package models

import (
	"time"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

// Dietitian 规划师/管理员账号模型
type Dietitian struct {
	AccountID string    `gorm:"column:account_id;type:varchar(20);primaryKey" json:"account_id"`
	Username  string    `gorm:"column:username;type:varchar(50);uniqueIndex:uk_dietitian_username;not null" json:"username"`
	Name      string    `gorm:"column:name;type:varchar(100)" json:"name"`
	Password  string    `gorm:"column:password;type:varchar(100);not null" json:"-"`
	RoleType  string    `gorm:"column:role_type;type:varchar(20);not null;index:idx_dietitian_role_status" json:"role_type"` // dietitian/admin
	Title     string    `gorm:"column:title;type:varchar(100)" json:"title"`
	Specialty string    `gorm:"column:specialty;type:varchar(100)" json:"specialty"`
	Introduction string  `gorm:"column:introduction;type:text" json:"introduction"`
	Contact   string    `gorm:"column:contact;type:varchar(50)" json:"contact"`
	CurrentServiceUserCount    int     `gorm:"column:current_service_user_count;not null;default:0" json:"current_service_user_count"`
	HistoricalServiceUserCount int     `gorm:"column:historical_service_user_count;not null;default:0" json:"historical_service_user_count"`
	HistoricalAvgRating        float64 `gorm:"column:historical_avg_rating;type:decimal(3,1);not null;default:0.0" json:"historical_avg_rating"`
	RatingCount                int     `gorm:"column:rating_count;not null;default:0" json:"rating_count"`
	Status    string    `gorm:"column:status;type:varchar(20);default:'启用';index:idx_dietitian_role_status" json:"status"`
	CreatedAt time.Time `gorm:"column:created_at;not null" json:"created_at"`
	UpdatedAt time.Time `gorm:"column:updated_at;not null" json:"updated_at"`
}

func (Dietitian) TableName() string {
	return "dietitian"
}

// BeforeSave 保存前加密密码
func (d *Dietitian) BeforeSave(tx *gorm.DB) error {
	if d.Password == "" {
		return nil
	}
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(d.Password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	d.Password = string(hashedPassword)
	return nil
}

// CheckPassword 检查密码是否正确
func (d *Dietitian) CheckPassword(password string) bool {
	return bcrypt.CompareHashAndPassword([]byte(d.Password), []byte(password)) == nil
}
