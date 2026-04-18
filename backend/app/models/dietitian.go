package models

import (
	"time"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

// Dietitian 规划师模型
type Dietitian struct {
	DietitianID string    `gorm:"column:dietitian_id;primaryKey" json:"dietitian_id"`
	Name        string    `gorm:"column:name;not null" json:"name"`
	Password    string    `gorm:"column:password;not null" json:"-"`
	Title       string    `gorm:"column:title;not null" json:"title"`
	Specialty   string    `gorm:"column:specialty;not null" json:"specialty"`
	Contact     string    `gorm:"column:contact;not null" json:"contact"`
	CreatedAt   time.Time `gorm:"column:created_at;not null" json:"created_at"`
	UpdatedAt   time.Time `gorm:"column:updated_at;not null" json:"updated_at"`
	Status      string    `gorm:"column:status;not null" json:"status"`
}

// TableName 指定表名
func (Dietitian) TableName() string {
	return "dietitian"
}

// BeforeSave 保存前加密密码
func (d *Dietitian) BeforeSave(tx *gorm.DB) error {
	if d.Password != "" {
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(d.Password), bcrypt.DefaultCost)
		if err != nil {
			return err
		}
		d.Password = string(hashedPassword)
	}
	return nil
}

// CheckPassword 检查密码是否正确
func (d *Dietitian) CheckPassword(password string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(d.Password), []byte(password))
	return err == nil
}
